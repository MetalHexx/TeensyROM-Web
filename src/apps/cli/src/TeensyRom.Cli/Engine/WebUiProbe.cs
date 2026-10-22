using TeensyRom.Cli.Api;

namespace TeensyRom.Cli.Engine;

/// <summary>Asks whether the engine serves the web app.</summary>
internal interface IWebUiProbe
{
    /// <summary>True when the engine's root answers 2xx with an HTML page.</summary>
    Task<bool> IsServingAsync(CancellationToken ct);
}

/// <summary>
/// Fetches the engine's root with its own client. Unlike <see cref="EngineProbe"/> it is quick: it only runs once the
/// engine is known to be up, and a source build without a built front end answers 404 straight away.
/// </summary>
internal sealed class WebUiProbe : IWebUiProbe
{
    /// <summary>The whole request, connecting included.</summary>
    public static readonly TimeSpan Budget = TimeSpan.FromSeconds(2);

    private readonly HttpClient _http;

    public WebUiProbe() : this(null) { }

    /// <param name="handler">Replaces the socket handler; tests use it to script answers.</param>
    public WebUiProbe(HttpMessageHandler? handler)
    {
        _http = new HttpClient(handler ?? new SocketsHttpHandler())
        {
            BaseAddress = new Uri(EngineAddress.BaseUrl),
            Timeout = Budget
        };
    }

    public async Task<bool> IsServingAsync(CancellationToken ct)
    {
        try
        {
            using var response = await _http.GetAsync("/", HttpCompletionOption.ResponseHeadersRead, ct);

            return response.IsSuccessStatusCode
                && response.Content.Headers.ContentType?.MediaType is "text/html" or "application/xhtml+xml";
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException)
        {
            return false;
        }
    }
}
