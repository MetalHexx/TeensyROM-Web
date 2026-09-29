namespace TeensyRom.Core.Device;

/// <summary>
/// Defines a strategy for discovering device endpoints (Serial COM ports or TCP IP addresses).
/// A strategy always performs its full scan; when and how often to call it is the caller's decision.
/// </summary>
public interface IDiscoveryStrategy
{
    /// <summary>
    /// Probes every candidate endpoint for this transport type with the version command and returns
    /// one <see cref="DiscoveredEndpoint"/> per TeensyROM reply, each with an open, positioned port.
    /// </summary>
    /// <param name="ct">Cancellation token to abort long-running scans.</param>
    /// <returns>A list of discovered TeensyROM endpoints.</returns>
    Task<List<DiscoveredEndpoint>> FindEndpoints(CancellationToken ct);
}
