using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Device;

/// <summary>
/// Discovery strategy for Serial (COM) ports.
/// Wraps SerialHelper.GetPorts() to return DiscoveredEndpoint records.
/// </summary>
public class SerialDiscoveryStrategy(ILoggingService log) : IDiscoveryStrategy
{
    /// <summary>
    /// Finds all available Serial COM ports on the system.
    /// </summary>
    /// <param name="ct">Cancellation token (not used for Serial discovery as it's fast).</param>
    /// <returns>List of Serial endpoints (COM ports) available on the system.</returns>
    public Task<List<DiscoveredEndpoint>> FindEndpoints(CancellationToken ct)
    {
        log.Internal("SerialDiscoveryStrategy: Scanning for COM ports");

        var ports = TeensyRom.Core.Serial.SerialHelper.GetPorts();
        var endpoints = ports
            .Select(port => new DiscoveredEndpoint(
                ConnectionType.Serial,
                port,
                Port: null  // Serial doesn't use port numbers
            ))
            .ToList();

        log.InternalSuccess($"SerialDiscoveryStrategy: Found {endpoints.Count} COM port(s)");

        return Task.FromResult(endpoints);
    }
}
