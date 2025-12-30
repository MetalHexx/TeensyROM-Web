namespace TeensyRom.Core.Device;

/// <summary>
/// Defines a strategy for discovering device endpoints (Serial COM ports or TCP IP addresses).
/// Implementations return lightweight endpoint information without performing device validation.
/// </summary>
public interface IDiscoveryStrategy
{
    /// <summary>
    /// Finds all available endpoints for the transport type (Serial or TCP).
    /// This method only performs discovery - no validation, version checking, or device creation.
    /// </summary>
    /// <param name="ct">Cancellation token to abort long-running scans.</param>
    /// <returns>A list of discovered endpoints that can be validated and connected to.</returns>
    Task<List<DiscoveredEndpoint>> FindEndpoints(CancellationToken ct);
}
