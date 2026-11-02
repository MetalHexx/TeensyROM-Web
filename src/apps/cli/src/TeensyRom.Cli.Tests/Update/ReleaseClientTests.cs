using System.Net;
using System.Security.Cryptography;
using System.Text;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

public sealed class ReleaseClientTests : IDisposable
{
    private readonly Scratch _scratch = new();

    public void Dispose() => _scratch.Dispose();

    private const string Feed = """
        [
          { "tag_name": "v1.0.0-beta.2", "draft": false, "prerelease": true, "html_url": "https://github.com/MetalHexx/TeensyROM-Suite/releases/tag/v1.0.0-beta.2",
            "assets": [
              { "name": "TeensyROM-Suite-1.0.0-beta.2-win-x64.zip", "size": 1234, "digest": "sha256:ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789",
                "browser_download_url": "https://github.com/MetalHexx/TeensyROM-Suite/releases/download/v1.0.0-beta.2/TeensyROM-Suite-1.0.0-beta.2-win-x64.zip" },
              { "name": "insecure.zip", "size": 1, "digest": null, "browser_download_url": "http://example.test/insecure.zip" }
            ] },
          { "tag_name": "v1.0.0-beta.3", "draft": true, "prerelease": true, "assets": [] },
          { "tag_name": "nightly", "draft": false, "prerelease": true, "assets": [] },
          { "tag_name": "v0.9.0", "draft": false, "prerelease": false, "assets": [] }
        ]
        """;

    private static HttpResponseMessage Json(string body, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private static ReleaseClient Client(StubHandler handler, string? feedOverride = null) =>
        new(ReleaseFeed.From(feedOverride), "1.0.0-alpha.8", handler);

    // ---- the feed ------------------------------------------------------------------------------------------

    [Fact]
    public async Task GetReleases_ReadsReleasesAndAssets_DroppingDraftsNonSemVerTagsAndInsecureAssets()
    {
        var handler = new StubHandler(_ => Json(Feed));

        var releases = await Client(handler).GetReleasesAsync(TimeSpan.FromSeconds(5));

        releases.Select(r => r.Tag).Should().Equal("v1.0.0-beta.2", "v0.9.0");
        var beta = releases[0];
        beta.Version.Should().Be(SemVersionTests.V("1.0.0-beta.2"));
        beta.IsPreRelease.Should().BeTrue();
        beta.PageUrl.Should().EndWith("v1.0.0-beta.2");
        beta.Assets.Should().ContainSingle().Which.Should().Be(new ReleaseAsset(
            "TeensyROM-Suite-1.0.0-beta.2-win-x64.zip",
            "https://github.com/MetalHexx/TeensyROM-Suite/releases/download/v1.0.0-beta.2/TeensyROM-Suite-1.0.0-beta.2-win-x64.zip",
            1234,
            "sha256:ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789"));
    }

    [Fact]
    public async Task GetReleases_AsksGitHubsApiAsTrom()
    {
        var handler = new StubHandler(_ => Json("[]"));

        await Client(handler).GetReleasesAsync(TimeSpan.FromSeconds(5));

        var seen = handler.Requests.Should().ContainSingle().Subject;
        seen.Uri.Should().Be(ReleaseFeed.DefaultUrl);
        seen.UserAgent.Should().Be("trom/1.0.0-alpha.8");
        seen.Accept.Should().Be("application/vnd.github+json");
    }

    [Fact]
    public async Task GetReleases_WithTheOverrideVariable_ReadsThatFeedAndAcceptsPlainHttpAssets()
    {
        var feed = """[ { "tag_name": "1.1.0", "assets": [ { "name": "a.zip", "size": 3, "browser_download_url": "http://127.0.0.1:8765/a.zip" } ] } ]""";
        var handler = new StubHandler(_ => Json(feed));

        var releases = await Client(handler, "http://127.0.0.1:8765/releases.json").GetReleasesAsync(TimeSpan.FromSeconds(5));

        handler.Requests.Single().Uri.Should().Be(new Uri("http://127.0.0.1:8765/releases.json"));
        releases.Single().Assets.Should().ContainSingle().Which.DownloadUrl.Should().Be("http://127.0.0.1:8765/a.zip");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not a url")]
    [InlineData("ftp://example.test/releases")]
    public void Feed_FallsBackToGitHubForAMissingOrUnusableOverride(string? overrideUrl)
    {
        var feed = ReleaseFeed.From(overrideUrl);

        feed.Url.Should().Be(ReleaseFeed.DefaultUrl);
        feed.AllowPlainHttp.Should().BeFalse();
    }

    [Fact]
    public async Task GetReleases_ForbiddenWithNoRateLimitLeft_SaysGitHubRefusedTheLookup()
    {
        var handler = new StubHandler(_ =>
        {
            var response = Json("{}", HttpStatusCode.Forbidden);
            response.Headers.Add("x-ratelimit-remaining", "0");
            return response;
        });

        var lookup = () => Client(handler).GetReleasesAsync(TimeSpan.FromSeconds(5));

        (await lookup.Should().ThrowAsync<CliException>()).Which.Message.Should().Be("GitHub refused the release lookup (rate limit) — try again later.");
    }

    [Fact]
    public async Task GetReleases_TooManyRequests_SaysGitHubRefusedTheLookup()
    {
        var handler = new StubHandler(_ => Json("{}", HttpStatusCode.TooManyRequests));

        var lookup = () => Client(handler).GetReleasesAsync(TimeSpan.FromSeconds(5));

        (await lookup.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("rate limit");
    }

    [Theory]
    [InlineData(HttpStatusCode.NotFound, "HTTP 404")]
    [InlineData(HttpStatusCode.Forbidden, "HTTP 403")]
    [InlineData(HttpStatusCode.InternalServerError, "HTTP 500")]
    public async Task GetReleases_AnyOtherFailure_NamesTheStatus(HttpStatusCode status, string expected)
    {
        var handler = new StubHandler(_ => Json("{}", status));

        var lookup = () => Client(handler).GetReleasesAsync(TimeSpan.FromSeconds(5));

        var error = (await lookup.Should().ThrowAsync<CliException>()).Which;
        error.Message.Should().Contain(expected).And.NotContain("rate limit");
        error.Code.Should().Be(CliExitCode.Failed);
    }

    [Fact]
    public async Task GetReleases_WhenTheConnectionFails_ReportsItAsAFailedLookup()
    {
        var handler = new StubHandler(_ => throw new HttpRequestException("No such host is known."));

        var lookup = () => Client(handler).GetReleasesAsync(TimeSpan.FromSeconds(5));

        (await lookup.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("No such host is known");
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("not json")]
    public async Task GetReleases_WhenTheFeedIsNotAReleaseList_ReportsItAsAFailedLookup(string body)
    {
        var handler = new StubHandler(_ => Json(body));

        var lookup = () => Client(handler).GetReleasesAsync(TimeSpan.FromSeconds(5));

        await lookup.Should().ThrowAsync<CliException>();
    }

    [Fact]
    public async Task GetReleases_WhenTheBudgetRunsOut_SaysItTimedOut()
    {
        var handler = new SlowHandler();

        var lookup = () => new ReleaseClient(ReleaseFeed.From(null), "1.0.0", handler).GetReleasesAsync(TimeSpan.FromMilliseconds(50));

        (await lookup.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("timed out");
    }

    [Fact]
    public async Task GetReleases_WhenTheCallerCancels_Rethrows()
    {
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        var lookup = () => new ReleaseClient(ReleaseFeed.From(null), "1.0.0", new SlowHandler()).GetReleasesAsync(TimeSpan.FromSeconds(5), cts.Token);

        await lookup.Should().ThrowAsync<OperationCanceledException>();
    }

    private sealed class SlowHandler : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            await Task.Delay(Timeout.Infinite, cancellationToken);
            return new HttpResponseMessage();
        }
    }

    // ---- the download --------------------------------------------------------------------------------------

    private static readonly byte[] Package = Encoding.UTF8.GetBytes(new string('x', 200_000));

    private static string Sha256(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

    private static ReleaseAsset Asset(string? digest, string url = "https://github.com/x/y/releases/download/v1/p.zip") =>
        new("p.zip", url, Package.Length, digest);

    private static StubHandler Serving(byte[] bytes) =>
        new(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(bytes) });

    [Fact]
    public async Task Download_WritesTheFile_ReportsProgressAndAcceptsAMatchingDigest()
    {
        var destination = _scratch.At("p.zip");
        var reports = new List<DownloadProgress>();

        await Client(Serving(Package)).DownloadVerifiedAsync(
            Asset("sha256:" + Sha256(Package).ToUpperInvariant()), destination, new SyncProgress(reports.Add));

        File.ReadAllBytes(destination).Should().Equal(Package);
        reports.Should().NotBeEmpty();
        reports[^1].Received.Should().Be(Package.Length);
        reports[^1].Total.Should().Be(Package.Length);
    }

    [Fact]
    public async Task Download_WhenTheDigestDoesNotMatch_DeletesTheFileAndRefuses()
    {
        var destination = _scratch.At("p.zip");

        var download = () => Client(Serving(Package)).DownloadVerifiedAsync(Asset("sha256:" + new string('0', 64)), destination, null);

        (await download.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("doesn't match").And.Contain("nothing was changed");
        File.Exists(destination).Should().BeFalse();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("sha1:da39a3ee5e6b4b0d3255bfef95601890afd80709")]
    [InlineData("sha256:xyz")]
    [InlineData("sha256:")]
    public async Task Download_WithoutAUsableDigest_RefusesBeforeAskingForTheFile(string? digest)
    {
        var handler = Serving(Package);

        var download = () => Client(handler).DownloadVerifiedAsync(Asset(digest), _scratch.At("p.zip"), null);

        (await download.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("no checksum");
        handler.Requests.Should().BeEmpty();
        File.Exists(_scratch.At("p.zip")).Should().BeFalse();
    }

    [Fact]
    public async Task Download_OverPlainHttp_IsRefusedUnlessTheFeedWasOverridden()
    {
        var handler = Serving(Package);
        var asset = Asset("sha256:" + Sha256(Package), "http://127.0.0.1:8765/p.zip");

        var refused = () => Client(handler).DownloadVerifiedAsync(asset, _scratch.At("p.zip"), null);
        await refused.Should().ThrowAsync<CliException>();
        handler.Requests.Should().BeEmpty();

        await Client(handler, "http://127.0.0.1:8765/releases.json").DownloadVerifiedAsync(asset, _scratch.At("q.zip"), null);
        File.ReadAllBytes(_scratch.At("q.zip")).Should().Equal(Package);
    }

    [Fact]
    public async Task Download_WhenTheServerFails_RefusesAndLeavesNoFile()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound));

        var download = () => Client(handler).DownloadVerifiedAsync(Asset("sha256:" + Sha256(Package)), _scratch.At("p.zip"), null);

        (await download.Should().ThrowAsync<CliException>()).Which.Message.Should().Contain("HTTP 404");
        File.Exists(_scratch.At("p.zip")).Should().BeFalse();
    }

    [Fact]
    public async Task Download_WhenCancelledPartWay_DeletesThePartialFile()
    {
        using var cts = new CancellationTokenSource();
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StreamContent(new CancellingStream(cts)) });

        var download = () => Client(handler).DownloadVerifiedAsync(Asset("sha256:" + Sha256(Package)), _scratch.At("p.zip"), null, cts.Token);

        await download.Should().ThrowAsync<OperationCanceledException>();
        File.Exists(_scratch.At("p.zip")).Should().BeFalse();
    }

    /// <summary>Delivers a first chunk, then the caller cancels while the next is being read.</summary>
    private sealed class CancellingStream(CancellationTokenSource cts) : Stream
    {
        private int _reads;

        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            if (_reads++ == 0)
            {
                buffer.Span[0] = 1;
                return 1;
            }

            await cts.CancelAsync();
            cancellationToken.ThrowIfCancellationRequested();
            return 0;
        }

        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }

    /// <summary>Reports on the calling thread, so a test reads the reports as soon as the download ends.</summary>
    private sealed class SyncProgress(Action<DownloadProgress> report) : IProgress<DownloadProgress>
    {
        public void Report(DownloadProgress value) => report(value);
    }
}
