using TeensyRom.Cli.Api;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Helpers;

namespace TeensyRom.Cli.Services;

/// <summary>
/// What a command that needs the engine does first: gets an engine running, then picks the TeensyROM to work with.
/// </summary>
internal sealed class StartupGate(IEngineControl engine, IDeviceService devices)
{
    private bool _ready;

    /// <summary>
    /// Returns true once an engine is running and a device is selected; false after telling the user what to fix.
    /// Once ready, later calls return true without checking again until <see cref="Reset"/>.
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

    /// <summary>Forgets the engine and device check, so the next engine command makes it again; call after the engine was stopped.</summary>
    public void Reset() => _ready = false;

    private async Task<bool> SelectDeviceAsync(CancellationToken ct)
    {
        List<DeviceSummary> online;

        try
        {
            online = (await devices.GetDevicesAsync(ct)).Where(d => d.IsOnline).ToList();
        }
        catch (TeensyApiException ex)
        {
            RadHelper.WriteError(ex.Message);
            return false;
        }

        if (online.Count == 0)
        {
            RadHelper.WriteError("No TeensyROM is online in tr-web — connect one in tr-web and try again.");
            return false;
        }

        var labels = online.Select(Label).ToList();
        string choice;

        try
        {
            choice = PromptHelper.FilePrompt("TeensyROM", labels);
        }
        catch (NotSupportedException)
        {
            RadHelper.WriteError("Choosing a TeensyROM needs an interactive terminal.");
            return false;
        }

        devices.Select(online[labels.IndexOf(choice)]);
        return true;
    }

    private static string Label(DeviceSummary device) => $"{device.Name} ({device.Connection})";
}
