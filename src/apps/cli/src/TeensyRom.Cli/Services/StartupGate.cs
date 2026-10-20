using TeensyRom.Cli.Api;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Helpers;

namespace TeensyRom.Cli.Services;

/// <summary>
/// What a menu entry that needs the engine does first: gets an engine running, then selects the TeensyROM to work
/// with. The device is chosen by the same <see cref="IDeviceChooser"/> the one-shot commands use: the only online
/// device is taken without asking, and the user is prompted only when several are online.
/// </summary>
internal sealed class StartupGate(IEngineControl engine, IDeviceService devices, IDeviceChooser chooser)
{
    private bool _ready;

    /// <summary>
    /// Returns true once an engine is running and a device is selected; false after telling the user what to fix.
    /// Once ready, later calls return true without checking again.
    /// </summary>
    public async Task<bool> EnsureReadyAsync(CancellationToken ct = default)
    {
        if (_ready) return true;

        var running = await engine.EnsureRunningAsync(ct);

        if (!running.Ok)
        {
            RadHelper.WriteError(running.FailureMessage ?? "The TeensyROM engine isn't running.");
            return false;
        }

        _ready = await SelectDeviceAsync(ct);
        return _ready;
    }

    private async Task<bool> SelectDeviceAsync(CancellationToken ct)
    {
        try
        {
            devices.Select(await chooser.ChooseAsync(null, DeviceScope.Online, ct));
            return true;
        }
        catch (Exception ex) when (ex is CliException or TeensyApiException)
        {
            RadHelper.WriteError(ex.Message);
            return false;
        }
    }
}
