using System.Net.Sockets;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;

namespace TeensyRom.Cli.Engine;

/// <summary>What the engine control needs to ask the engine over HTTP.</summary>
internal interface IEngineProbe
{
    /// <summary>Asks the port for the engine's version and classifies the answer.</summary>
    Task<EngineProbeResult> ProbeAsync(CancellationToken ct);

    /// <summary>Asks a running engine to stop; the engine answers before it begins stopping.</summary>
    Task<EngineStopRequest> RequestStopAsync(CancellationToken ct);
}

/// <summary>
/// Looks at the engine port with its own short-timeout client (the CLI's shared client waits forever).
/// </summary>
/// <remarks>
/// Whether something is listening is decided by exception type, never by elapsed time: Windows can take seconds to
/// refuse a loopback connection, and a slow refusal must not read as an engine that is still starting.
/// </remarks>
internal sealed class EngineProbe : IEngineProbe
{
    /// <summary>Generous so a slow loopback refusal still ends as a refusal.</summary>
    public static readonly TimeSpan DefaultConnectTimeout = TimeSpan.FromSeconds(10);

    /// <summary>How long a connected engine gets to answer.</summary>
    public static readonly TimeSpan DefaultResponseBudget = TimeSpan.FromSeconds(5);

    private readonly TeensyRomApiClient _api;

    public EngineProbe() : this(new Uri(EngineAddress.BaseUrl), DefaultConnectTimeout, DefaultResponseBudget) { }

    /// <param name="handler">Replaces the socket handler; tests use it to script transport failures.</param>
    public EngineProbe(Uri baseAddress, TimeSpan connectTimeout, TimeSpan responseBudget, HttpMessageHandler? handler = null)
    {
        handler ??= new SocketsHttpHandler { ConnectTimeout = connectTimeout };

        _api = new TeensyRomApiClient(new HttpClient(handler)
        {
            BaseAddress = baseAddress,
            Timeout = connectTimeout + responseBudget
        });
    }

    public async Task<EngineProbeResult> ProbeAsync(CancellationToken ct)
    {
        try
        {
            var response = await _api.GetVersionAsync(ct);

            return string.IsNullOrWhiteSpace(response.Version)
                ? new EngineProbeResult.Foreign("it answered 200 without a version")
                : new EngineProbeResult.Engine(response.Version);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            return new EngineProbeResult.NotReady();
        }
        catch (ApiException ex) when (ex.StatusCode >= 500)
        {
            return new EngineProbeResult.NotReady();
        }
        catch (ApiException ex) when (IsSuccess(ex.StatusCode))
        {
            return new EngineProbeResult.Foreign("it answered 200 without a version");
        }
        catch (ApiException ex)
        {
            return new EngineProbeResult.Foreign($"it answered HTTP {ex.StatusCode}");
        }
        catch (HttpRequestException ex)
        {
            return IsNothingListening(ex) ? new EngineProbeResult.Unreachable() : new EngineProbeResult.NotReady();
        }
    }

    public async Task<EngineStopRequest> RequestStopAsync(CancellationToken ct)
    {
        try
        {
            await _api.StopEngineAsync(ct);
            return EngineStopRequest.Accepted;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            return EngineStopRequest.Failed;
        }
        catch (ApiException ex) when (ex.StatusCode is 404 or 405)
        {
            return EngineStopRequest.NotSupported;
        }
        catch (ApiException ex) when (IsSuccess(ex.StatusCode))
        {
            return EngineStopRequest.Accepted;
        }
        catch (ApiException)
        {
            return EngineStopRequest.Failed;
        }
        catch (HttpRequestException ex)
        {
            return IsNothingListening(ex) ? EngineStopRequest.Gone : EngineStopRequest.Failed;
        }
    }

    private static bool IsSuccess(int statusCode) => statusCode is >= 200 and < 300;

    private static bool IsNothingListening(HttpRequestException ex)
    {
        for (Exception? inner = ex; inner is not null; inner = inner.InnerException)
        {
            if (inner is SocketException { SocketErrorCode: SocketError.ConnectionRefused or SocketError.HostUnreachable or SocketError.NetworkUnreachable })
            {
                return true;
            }
        }
        return false;
    }
}
