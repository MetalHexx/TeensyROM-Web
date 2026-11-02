using TeensyRom.Cli.Api;
using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.WebUi;

/// <summary>
/// What <c>trom ui</c> found and did, in the shape of its <c>--json</c> output.
/// </summary>
/// <param name="Address">Where Trom UI is on this computer.</param>
/// <param name="NetworkAddresses">Where other devices on the network reach it.</param>
/// <param name="Available">The engine serves Trom UI.</param>
/// <param name="Opened">A browser was asked to open <paramref name="Address"/>.</param>
/// <param name="Problem">Why Trom UI isn't served, when it isn't.</param>
/// <param name="OpenFailure">Why no browser opened, when one was asked for and didn't.</param>
internal sealed record UiReport(
    string Address,
    IReadOnlyList<string> NetworkAddresses,
    bool Available,
    bool Opened,
    string? Problem = null,
    string? OpenFailure = null);

/// <summary>
/// Checks that a running engine serves Trom UI and opens it in the browser. Starting the engine is the caller's job.
/// </summary>
internal sealed class UiLauncher(IWebUiProbe probe, IBrowserOpener opener, ILanAddresses lan, IEngineLocator locator)
{
    public const string LocalAddress = "http://localhost:10213";

    /// <param name="open">Open the browser; false only reports.</param>
    public async Task<UiReport> OpenAsync(bool open, CancellationToken ct = default)
    {
        var network = lan.Find().Select(address => $"http://{address}:{EngineAddress.Port}").ToList();

        if (!await probe.IsServingAsync(ct))
        {
            return new UiReport(LocalAddress, network, Available: false, Opened: false, Problem: WebUiDiagnosis.Problem(locator));
        }

        if (!open) return new UiReport(LocalAddress, network, Available: true, Opened: false);

        var result = await opener.OpenAsync(LocalAddress, ct);

        return new UiReport(LocalAddress, network, Available: true, result.Opened, OpenFailure: result.Failure);
    }
}
