using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;

namespace TeensyRom.Cli.Update;

/// <summary>Reads the published releases and downloads their packages.</summary>
internal interface IReleaseClient
{
    /// <summary>The published releases, newest first as the feed lists them. Drafts and tags that aren't SemVer are left out.</summary>
    /// <exception cref="Errors.CliException">When the feed can't be read within <paramref name="timeout"/>.</exception>
    Task<IReadOnlyList<ReleaseInfo>> GetReleasesAsync(TimeSpan timeout, CancellationToken ct = default);

    /// <summary>
    /// Downloads <paramref name="asset"/> to <paramref name="destination"/> and checks it against the SHA-256 digest the
    /// release published. A package without a digest is refused before any download; one that doesn't match is deleted.
    /// </summary>
    /// <exception cref="Errors.CliException">When the download is refused, fails or doesn't match.</exception>
    Task DownloadVerifiedAsync(ReleaseAsset asset, string destination, IProgress<DownloadProgress>? progress, CancellationToken ct = default);
}

/// <summary>
/// Where the releases are listed. Plain <c>http</c> for the feed and the packages is allowed only when the hidden
/// <c>TROM_RELEASES_URL</c> variable points the feed somewhere else, which is how tests serve a fake release.
/// </summary>
internal sealed record ReleaseFeed(Uri Url, bool AllowPlainHttp)
{
    public const string OverrideVariable = "TROM_RELEASES_URL";

    public static readonly Uri DefaultUrl = new("https://api.github.com/repos/MetalHexx/TeensyROM-Suite/releases?per_page=30");

    public static ReleaseFeed FromEnvironment() => From(Environment.GetEnvironmentVariable(OverrideVariable));

    /// <summary>The override when it is an absolute http(s) address, else the GitHub feed.</summary>
    public static ReleaseFeed From(string? overrideUrl) =>
        Uri.TryCreate(overrideUrl, UriKind.Absolute, out var url) && url.Scheme is "http" or "https"
            ? new ReleaseFeed(url, AllowPlainHttp: true)
            : new ReleaseFeed(DefaultUrl, AllowPlainHttp: false);

    public bool Allows(Uri url) => url.Scheme == Uri.UriSchemeHttps || (AllowPlainHttp && url.Scheme == Uri.UriSchemeHttp);
}

/// <summary>Reads the GitHub release feed and downloads packages from it over HTTPS.</summary>
/// <param name="cliVersion">Sent as <c>User-Agent: trom/&lt;version&gt;</c>, which GitHub requires.</param>
/// <param name="handler">Replaces the socket handler; tests use it to script the feed.</param>
internal sealed class ReleaseClient : IReleaseClient
{
    private const string DigestPrefix = "sha256:";

    private readonly ReleaseFeed _feed;
    private readonly HttpClient _http;

    public ReleaseClient(ReleaseFeed feed, string cliVersion, HttpMessageHandler? handler = null)
    {
        _feed = feed;
        _http = new HttpClient(handler ?? new SocketsHttpHandler()) { Timeout = Timeout.InfiniteTimeSpan };

        if (!_http.DefaultRequestHeaders.UserAgent.TryParseAdd($"trom/{cliVersion}")) _http.DefaultRequestHeaders.UserAgent.ParseAdd("trom");
    }

    public async Task<IReadOnlyList<ReleaseInfo>> GetReleasesAsync(TimeSpan timeout, CancellationToken ct = default)
    {
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct);
        budget.CancelAfter(timeout);

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, _feed.Url);
            request.Headers.Accept.ParseAdd("application/vnd.github+json");

            using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, budget.Token);

            if (!response.IsSuccessStatusCode) throw FeedFailure(response);

            await using var body = await response.Content.ReadAsStreamAsync(budget.Token);
            using var document = await JsonDocument.ParseAsync(body, cancellationToken: budget.Token);

            return Parse(document.RootElement);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw UpdateFailure.Failed("Looking up the latest release timed out — check your connection and try again.");
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException)
        {
            throw UpdateFailure.Failed($"Couldn't look up the latest release: {ex.Message.TrimEnd('.')}.");
        }
    }

    public async Task DownloadVerifiedAsync(ReleaseAsset asset, string destination, IProgress<DownloadProgress>? progress, CancellationToken ct = default)
    {
        var expected = ExpectedDigest(asset)
            ?? throw UpdateFailure.Failed($"The release publishes no checksum for {asset.Name}, so trom won't install it.");

        if (!Uri.TryCreate(asset.DownloadUrl, UriKind.Absolute, out var url) || !_feed.Allows(url))
        {
            throw UpdateFailure.Failed($"The release links {asset.Name} over an address trom doesn't download from ({asset.DownloadUrl}).");
        }

        try
        {
            var actual = await DownloadAsync(url, destination, asset.Size, progress, ct);

            if (!string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase))
            {
                File.Delete(destination);
                throw UpdateFailure.Failed($"{asset.Name} doesn't match the checksum the release published, so it was discarded and nothing was changed.");
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or IOException or UnauthorizedAccessException)
        {
            TryDelete(destination);
            throw UpdateFailure.Failed($"Couldn't download {asset.Name}: {ex.Message.TrimEnd('.')}.");
        }
        catch (OperationCanceledException)
        {
            TryDelete(destination);
            throw;
        }
    }

    /// <summary>The lower-case hex SHA-256 the release published for <paramref name="asset"/>; null when it published none, or one that isn't a SHA-256.</summary>
    internal static string? ExpectedDigest(ReleaseAsset asset)
    {
        if (asset.Digest is not { } digest || !digest.StartsWith(DigestPrefix, StringComparison.OrdinalIgnoreCase)) return null;

        var hex = digest[DigestPrefix.Length..];

        return hex.Length == SHA256.HashSizeInBytes * 2 && hex.All(char.IsAsciiHexDigit) ? hex.ToLowerInvariant() : null;
    }

    private async Task<string> DownloadAsync(Uri url, string destination, long expectedSize, IProgress<DownloadProgress>? progress, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/octet-stream"));

        using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);

        if (!response.IsSuccessStatusCode) throw new HttpRequestException($"the server answered HTTP {(int)response.StatusCode}");

        long? total = response.Content.Headers.ContentLength ?? (expectedSize > 0 ? expectedSize : null);
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var buffer = new byte[81920];
        long received = 0;

        await using var source = await response.Content.ReadAsStreamAsync(ct);
        await using var file = new FileStream(destination, FileMode.Create, FileAccess.Write, FileShare.None, buffer.Length, useAsync: true);

        while (await source.ReadAsync(buffer, ct) is var read and > 0)
        {
            hash.AppendData(buffer, 0, read);
            await file.WriteAsync(buffer.AsMemory(0, read), ct);
            received += read;
            progress?.Report(new DownloadProgress(received, total));
        }

        await file.FlushAsync(ct);

        return Convert.ToHexString(hash.GetHashAndReset());
    }

    private static Errors.CliException FeedFailure(HttpResponseMessage response)
    {
        var rateLimited = response.StatusCode == HttpStatusCode.TooManyRequests
            || (response.StatusCode == HttpStatusCode.Forbidden && response.Headers.TryGetValues("x-ratelimit-remaining", out var left) && left.FirstOrDefault() == "0");

        return UpdateFailure.Failed(rateLimited
            ? "GitHub refused the release lookup (rate limit) — try again later."
            : $"The release lookup failed: the server answered HTTP {(int)response.StatusCode}.");
    }

    private IReadOnlyList<ReleaseInfo> Parse(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Array) throw new JsonException("the feed isn't a list of releases");

        var releases = new List<ReleaseInfo>();

        foreach (var release in root.EnumerateArray())
        {
            if (release.ValueKind != JsonValueKind.Object || Flag(release, "draft")) continue;

            if (Text(release, "tag_name") is not { } tag || !SemVersion.TryParse(tag, out var version)) continue;

            releases.Add(new ReleaseInfo(tag, version, Flag(release, "prerelease"), Text(release, "html_url"), Assets(release)));
        }
        return releases;
    }

    private List<ReleaseAsset> Assets(JsonElement release)
    {
        var assets = new List<ReleaseAsset>();

        if (!release.TryGetProperty("assets", out var list) || list.ValueKind != JsonValueKind.Array) return assets;

        foreach (var asset in list.EnumerateArray().Where(item => item.ValueKind == JsonValueKind.Object))
        {
            if (Text(asset, "name") is not { } name
                || Text(asset, "browser_download_url") is not { } link
                || !Uri.TryCreate(link, UriKind.Absolute, out var url)
                || !_feed.Allows(url))
            {
                continue;
            }

            var size = asset.TryGetProperty("size", out var bytes) && bytes.ValueKind == JsonValueKind.Number && bytes.TryGetInt64(out var count) ? count : 0;

            assets.Add(new ReleaseAsset(name, link, size, Text(asset, "digest")));
        }
        return assets;
    }

    private static string? Text(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static bool Flag(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;

    private static void TryDelete(string path)
    {
        try { File.Delete(path); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }
}
