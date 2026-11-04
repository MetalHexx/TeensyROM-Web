using TeensyRom.Cli.Api;
using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.WebUi;

/// <summary>
/// What <c>trom ui</c> found and did, in the shape of its <c>--json</c> output.
/// </summary>
/// <param name="Address">Where Trom UI is on this computer.</param>
/// <param name="NetworkAddresses">Where other devices on the network reach it.</param>
/// <param name="SecureNetworkAddresses">The https address on each network address; empty unless the engine's HTTPS is listening.</param>
/// <param name="Available">The engine serves Trom UI.</param>
/// <param name="Opened">A browser was asked to open <paramref name="Address"/>.</param>
/// <param name="Https">The engine's HTTPS, when it reported any.</param>
/// <param name="Problem">Why Trom UI isn't served, when it isn't.</param>
/// <param name="OpenFailure">Why no browser opened, when one was asked for and didn't.</param>
internal sealed record UiReport(
    string Address,
    IReadOnlyList<string> NetworkAddresses,
    IReadOnlyList<string> SecureNetworkAddresses,
    bool Available,
    bool Opened,
    EngineHttps? Https = null,
    string? Problem = null,
    string? OpenFailure = null);

/// <summary>
/// Checks that a running engine serves Trom UI and opens it in the browser. Starting the engine is the caller's job.
/// </summary>
internal sealed class UiLauncher(IWebUiProbe probe, IBrowserOpener opener, ILanAddresses lan, IEngineLocator locator, IEngineControl engine)
{
    public const string LocalAddress = "http://localhost:10213";

    /// <param name="open">Open the browser; false only reports.</param>
    public async Task<UiReport> OpenAsync(bool open, CancellationToken ct = default)
    {
        var addresses = lan.Find().ToList();
        var network = addresses.Select(address => $"http://{address}:{EngineAddress.Port}").ToList();

        if (!await probe.IsServingAsync(ct))
        {
            return new UiReport(LocalAddress, network, [], Available: false, Opened: false, Problem: WebUiDiagnosis.Problem(locator));
        }

        var https = (await engine.GetStatusAsync(ct)).Https;
        IReadOnlyList<string> secure = https is { Listening: true }
            ? addresses.Select(address => $"https://{address}:{https.Port}").ToList()
            : [];

        if (!open) return new UiReport(LocalAddress, network, secure, Available: true, Opened: false, Https: https);

        var result = await opener.OpenAsync(LocalAddress, ct);

        return new UiReport(LocalAddress, network, secure, Available: true, result.Opened, https, OpenFailure: result.Failure);
    }
}
