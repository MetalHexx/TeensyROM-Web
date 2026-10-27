using System.Diagnostics;
using TeensyRom.Cli.Logging;

namespace TeensyRom.Cli.Api;

/// <summary>
/// Logs every call to tr-web as "METHOD path → status (ms)" and failures that never got an answer as errors.
/// </summary>
internal sealed class ApiLoggingHandler(ILoggingService log) : DelegatingHandler(new HttpClientHandler())
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var call = $"{request.Method} {request.RequestUri?.PathAndQuery}";
        var timer = Stopwatch.StartNew();

        HttpResponseMessage response;

        try
        {
            response = await base.SendAsync(request, cancellationToken);
        }
        catch (Exception ex)
        {
            Guarded(() => log.InternalError($"{call} → failed ({timer.ElapsedMilliseconds} ms): {ex.GetType().Name}: {ex.Message}"));
            throw;
        }

        Guarded(() => log.Internal($"{call} → {(int)response.StatusCode} ({timer.ElapsedMilliseconds} ms)"));
        return response;
    }

    /// <summary>A logger fault must never change the call's response or replace the exception it rethrows.</summary>
    private static void Guarded(Action logCall)
    {
        try { logCall(); }
        catch (Exception ex) { Debug.WriteLine($"API call log failed: {ex.Message}"); }
    }
}
