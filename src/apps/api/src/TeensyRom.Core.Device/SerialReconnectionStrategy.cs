using System.Reactive.Linq;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.State;

namespace TeensyRom.Core.Device;

public class SerialReconnectionStrategy(ILoggingService log, IFwVersionChecker versionChecker) : IReconnectionStrategy
{
    public async Task<bool> TryReconnect(TeensyRomDevice device, CancellationToken ct)
    {
        var methodName = $"SerialReconnectionStrategy.TryReconnect({device.DeviceId}):";

        // Get available COM ports, excluding the current port
        var allPorts = SerialHelper.GetPorts();
        var availablePorts = allPorts.Where(p => p != device.Cart.ComPort).ToList();

        if (availablePorts.Count == 0)
        {
            log.Internal($"{methodName} No available COM ports to try for reconnection");
            return false;
        }

        log.Internal($"{methodName} Trying {availablePorts.Count} available COM ports for reconnection");

        foreach (var port in availablePorts)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
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

                // Set new port, open, lock
                device.SerialState.SetPort(port);
                device.SerialState.OpenPort();
                device.SerialState.Lock();
                device.SerialState.TransitionTo(typeof(SerialBusyState));

                // Version check
                var (isTeensyRom, isMinimal, isVersionCompatible, version) = versionChecker.GetAllVersionInfo(device.SerialState);

                if (!isTeensyRom)
                {
                    log.Internal($"{methodName} Port {port} is not a TeensyROM device, trying next port");
                    device.SerialState.ClosePort();
                    continue;
                }

                // Success - update Cart.ComPort and return true
                device.Cart.ComPort = port;
                log.InternalSuccess($"{methodName} Successfully reconnected to {device.DeviceId} on {port}");
                return true;
            }
            catch (Exception ex)
            {
                log.ExternalError($"{methodName} Error trying port {port}: {ex.Message}");
                // Continue to next port
            }
        }

        // All ports failed
        log.InternalError($"{methodName} Could not reconnect to {device.DeviceId} after trying all available ports. Check your devices and try reconnecting.");
        device.SerialState.ClosePort();
        return false;
    }
}
