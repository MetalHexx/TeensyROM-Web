using System.Net.Http.Headers;

namespace TeensyRom.Cli.Api.Generated;

public partial interface ITeensyRomApiClient
{
    /// <summary>
    /// Streams one file's raw bytes into a transfer job at <paramref name="path"/> (relative to the job's destination,
    /// '/'-separated). The generated <c>UploadTransferFileAsync</c> can't do this: the spec doesn't describe the raw body,
    /// so it sends an empty JSON one.
    /// </summary>
    /// <param name="length">The exact number of bytes <paramref name="content"/> will yield, sent as the Content-Length.</param>
    /// <exception cref="ApiException">tr-web refused the file; the response body is on <see cref="ApiException.Response"/>.</exception>
    Task<UploadFileResponse> UploadTransferFileContentAsync(string jobId, string path, Stream content, long length, CancellationToken cancellationToken = default);
}

/// <summary>Hand-written half of the generated client, outside <c>Generated/</c> so a regeneration never touches it.</summary>
public partial class TeensyRomApiClient
{
    public virtual async Task<UploadFileResponse> UploadTransferFileContentAsync(string jobId, string path, Stream content, long length, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(jobId);
        ArgumentNullException.ThrowIfNull(path);
        ArgumentNullException.ThrowIfNull(content);

        using var request = new HttpRequestMessage(HttpMethod.Post, $"api/transfers/{Uri.EscapeDataString(jobId)}/files?Path={Uri.EscapeDataString(path)}");

        request.Headers.Accept.Add(MediaTypeWithQualityHeaderValue.Parse("application/json"));
        request.Content = new StreamContent(content);
        request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse("application/octet-stream");
        request.Content.Headers.ContentLength = length;

        using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);

        var headers = new Dictionary<string, IEnumerable<string>>();

        foreach (var header in response.Headers) headers[header.Key] = header.Value;
        foreach (var header in response.Content.Headers) headers[header.Key] = header.Value;

        var status = (int)response.StatusCode;

        if (status != 200)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

            throw new ApiException($"The HTTP status code of the response was not expected ({status}).", status, body, headers, null);
        }

        var result = await ReadObjectResponseAsync<UploadFileResponse>(response, headers, cancellationToken).ConfigureAwait(false);

        return result.Object ?? throw new ApiException("Response was null which was not expected.", status, result.Text, headers, null);
    }
}
