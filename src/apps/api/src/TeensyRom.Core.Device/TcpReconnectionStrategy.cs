using System.Reactive.Linq;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.State;

namespace TeensyRom.Core.Device;

public class TcpReconnectionStrategy(ILoggingService log, IFwVersionChecker versionChecker) : IReconnectionStrategy
{
    private readonly int[] _backoffDelays = [500, 1000, 1500]; // ms

    public async Task<bool> TryReconnect(TeensyRomDevice device, CancellationToken ct)
    {
        var methodName = $"TcpReconnectionStrategy.TryReconnect({device.DeviceId}):";
        var endpoint = $"{device.Cart.IpAddress}:{device.Cart.TcpPort}";

        log.Internal($"{methodName} Attempting to reconnect to {endpoint} with up to 3 retry attempts");

        for (int attempt = 1; attempt <= 3; attempt++)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                log.Internal($"{methodName} Retry attempt {attempt}/3 for {endpoint}");

                // Get current state and transition
                var state = await device.SerialState.CurrentState.FirstAsync();
                device.SerialState.TransitionTo(typeof(SerialConnectedState));

                // Close existing port if open
                if (device.SerialState.IsOpen)
                {
                    try
                    {
                        device.SerialState.ClosePort();
                    }
                    catch
                    {
                        // Ignore errors when closing
                    }
                }

                // Set endpoint, open, lock
                device.SerialState.SetPort(endpoint);
                device.SerialState.OpenPort();
                device.SerialState.Lock();
                device.SerialState.TransitionTo(typeof(SerialBusyState));

                // Version check
                var (isTeensyRom, isMinimal, isVersionCompatible, version) = versionChecker.GetAllVersionInfo(device.SerialState);

                if (isTeensyRom)
                {
                    log.InternalSuccess($"{methodName} Successfully reconnected to {device.DeviceId} at {endpoint} on attempt {attempt}");
                    return true;
                }

                // Not a TeensyROM device - close and retry
                log.Internal($"{methodName} Endpoint {endpoint} did not respond as TeensyROM on attempt {attempt}");
                device.SerialState.ClosePort();
            }
            catch (Exception ex)
            {
                log.ExternalError($"{methodName} Error on attempt {attempt} for {endpoint}: {ex.Message}");
            }

            // Backoff before next retry (except on last attempt)
            if (attempt < 3)
            {
                var delay = _backoffDelays[attempt - 1];
                log.Internal($"{methodName} Waiting {delay}ms before retry attempt {attempt + 1}");
                await Task.Delay(delay, ct);
            }
        }

        // All retries failed
        log.InternalError($"{methodName} Could not reconnect to {device.DeviceId} at {endpoint} after 3 attempts. Check your device and network connection.");
        device.SerialState.ClosePort();
        return false;
    }
}
