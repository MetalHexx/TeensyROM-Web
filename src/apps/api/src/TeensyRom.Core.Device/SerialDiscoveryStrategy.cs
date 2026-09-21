using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.Usb;

namespace TeensyRom.Core.Device;

/// <summary>
/// Discovery strategy for Serial (COM) ports. Opens only the ports the USB-descriptor locator names as
/// TeensyROM devices, falling back to every present port - with a warning - when the descriptor filter
/// is unavailable. Each candidate is validated with a single version probe; only a TeensyROM reply
/// yields an endpoint, with the port left open and positioned for the finder to use.
/// </summary>
public class SerialDiscoveryStrategy(
    ILoggingService log,
    IDeviceTransportFactory transportFactory,
    ITeensyPortLocator locator,
    IDeviceInterrogator interrogator) : IDiscoveryStrategy
{
    public Task<List<DiscoveredEndpoint>> FindEndpoints(CancellationToken ct)
    {
        var located = locator.ListPorts();

        List<string> candidates;
        Dictionary<string, string> descriptorChipIds;

        if (located.FilterAvailable)
        {
            candidates = located.Ports.Select(p => p.PortName).ToList();
            descriptorChipIds = located.Ports.ToDictionary(p => p.PortName, p => p.ChipId);
        }
        else
        {
            candidates = SerialHelper.GetComPorts();
            descriptorChipIds = [];
            log.InternalWarning($"Serial discovery: descriptor filter unavailable ({located.UnavailableReason}); probing all {candidates.Count} port(s)");
        }

        var discovered = new List<DiscoveredEndpoint>();

        foreach (var portName in candidates)
        {
            ct.ThrowIfCancellationRequested();

            var endpoint = TryDiscoverDevice(portName, descriptorChipIds.GetValueOrDefault(portName));
            if (endpoint is not null)
            {
                discovered.Add(endpoint);
            }
        }

        return Task.FromResult(discovered);
    }

    /// <summary>
    /// Opens one candidate port and probes it with the version command. Returns null - the port
    /// disposed - unless the reply proves a TeensyROM is present; an open failure is logged and
    /// skipped rather than thrown, since one bad port must not abort the rest of the scan.
    /// </summary>
    private DiscoveredEndpoint? TryDiscoverDevice(string portName, string? descriptorChipId)
    {
        ICommunicationPort? communicationPort = null;

        try
        {
            communicationPort = transportFactory.CreateSerial(portName);
            communicationPort.OpenPort(useRetryLoop: false);
        }
        catch (Exception ex)
        {
            communicationPort?.Dispose();
            log.Internal($"{portName}: {ex.Message}");
            return null;
        }

        var version = interrogator.ReadVersion(communicationPort);

        if (!version.IsTeensyRom)
        {
            log.Internal($"{portName}: no version reply ({(string.IsNullOrEmpty(version.RawText) ? "empty" : version.RawText)})");
            communicationPort.Dispose();
            return null;
        }

        if (descriptorChipId is not null && version.ChipId is not null &&
            !string.Equals(descriptorChipId, version.ChipId, StringComparison.OrdinalIgnoreCase))
        {
            log.Internal($"{portName}: descriptor says {descriptorChipId}, reply says {version.ChipId}");
        }

        return new DiscoveredEndpoint(ConnectionType.Serial, portName, null, version, communicationPort);
    }
}
