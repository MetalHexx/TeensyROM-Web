using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using System.Diagnostics;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Logging;

namespace TeensyRom.Cli.Services;

/// <summary>
/// Follows tr-web's log over its SignalR hub, which sends every device's lines to each connection that subscribed.
/// </summary>
/// <remarks>
/// tr-web counts listeners per connection: this follow subscribes its own hub connection and unsubscribes it when
/// it ends, so it neither starts nor stops anyone else's log, such as an open web log viewer.
/// </remarks>
internal sealed class DeviceLogStream(IDeviceService devices, ILoggingService log, Uri apiAddress) : IDeviceLogStream
{
    private const string HubPath = "/api/logHub";
    private const string LogProducedEvent = "LogProduced";
    private const string SubscribeMethod = "Subscribe";
    private const string UnsubscribeMethod = "Unsubscribe";

    public async Task<IAsyncDisposable> FollowAsync(Action<string> onLine, CancellationToken ct = default)
    {
        var deviceId = devices.RequireDeviceId();
        var hub = new HubConnectionBuilder().WithUrl(new Uri(apiAddress, HubPath)).Build();
        var following = new Following(hub, log);

        hub.On<string>(LogProducedEvent, line =>
        {
            following.NoteLine();

            if (TryReadMessage(line, deviceId, out var message))
            {
                onLine(message);
            }
        });

        try
        {
            await ApiErrors.Call(() => hub.StartAsync(ct));
            await SubscribeAsync(hub, ct);
        }
        catch
        {
            await hub.DisposeAsync();
            throw;
        }
        return following;
    }

    // A tr-web without per-listener logs answers the invoke with a HubException (no such method); a connection that
    // dropped meanwhile throws InvalidOperationException. Neither is an API failure ApiErrors knows.
    private static async Task SubscribeAsync(HubConnection hub, CancellationToken ct)
    {
        try
        {
            await ApiErrors.Call(() => hub.InvokeAsync(SubscribeMethod, ct));
        }
        catch (Exception ex) when (ex is HubException or InvalidOperationException)
        {
            throw new TeensyApiException($"tr-web wouldn't let this CLI follow its log: {ex.Message}", inner: ex);
        }
    }

    /// <summary>
    /// Reads a line tr-web logged for the device, which arrives as "(deviceId) Level: message". Lines for other
    /// devices, or for none, are not the device's.
    /// </summary>
    public static bool TryReadMessage(string line, string deviceId, out string message)
    {
        message = string.Empty;
        var prefix = $"({deviceId}) ";

        if (!line.StartsWith(prefix, StringComparison.Ordinal)) return false;

        var withLevel = line[prefix.Length..];
        var levelEnd = withLevel.IndexOf(": ", StringComparison.Ordinal);

        message = levelEnd < 0 ? withLevel : withLevel[(levelEnd + 2)..];
        return true;
    }

    private sealed class Following(HubConnection hub, ILoggingService log) : IAsyncDisposable
    {
        // tr-web hands its queued lines to SignalR in batches every 100 ms and throws away whatever is still queued when
        // this connection unsubscribes, so the lines logged just before then need a moment to arrive.
        private static readonly TimeSpan QuietPeriod = TimeSpan.FromMilliseconds(300);
        private static readonly TimeSpan DrainLimit = TimeSpan.FromSeconds(3);

        private long _lastLine = Stopwatch.GetTimestamp();

        public void NoteLine() => Volatile.Write(ref _lastLine, Stopwatch.GetTimestamp());

        public async ValueTask DisposeAsync()
        {
            try
            {
                await WaitForQuietAsync();
                await hub.InvokeAsync(UnsubscribeMethod);
            }
            catch (Exception ex)
            {
                log.InternalError($"Couldn't stop following tr-web's log: {ex.Message}");
            }
            finally
            {
                await hub.DisposeAsync();
            }
        }

        private async Task WaitForQuietAsync()
        {
            var waited = Stopwatch.StartNew();

            while (waited.Elapsed < DrainLimit && Stopwatch.GetElapsedTime(Volatile.Read(ref _lastLine)) < QuietPeriod)
            {
                await Task.Delay(25);
            }
        }
    }
}
