using Spectre.Console.Cli;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Commands.Common;

/// <summary>
/// A <c>trom</c> command that never touches the engine. Failures are thrown as <see cref="CliException"/>
/// (or let through for <see cref="ExitCodeMapper"/>); the session turns them into the exit code and the message.
/// </summary>
internal abstract class TromCommand<T>(ICliOutput output) : AsyncCommand<T> where T : TromSettings
{
    protected ICliOutput Output { get; } = output;

    public sealed override async Task<int> ExecuteAsync(CommandContext context, T settings)
    {
        await PrepareAsync(settings, CancellationToken.None);

        return await RunAsync(context, settings, CancellationToken.None);
    }

    /// <summary>What must be true before <see cref="RunAsync"/>; nothing here.</summary>
    protected virtual Task PrepareAsync(T settings, CancellationToken ct) => Task.CompletedTask;

    protected abstract Task<int> RunAsync(CommandContext context, T settings, CancellationToken ct);
}

/// <summary>
/// A command that needs a running engine of this CLI's version, started or replaced first when necessary.
/// </summary>
internal abstract class EngineCommand<T>(ICliOutput output, IEngineControl engine) : TromCommand<T>(output) where T : TromSettings
{
    /// <exception cref="CliException"><see cref="CliExitCode.EngineUnavailable"/> when no engine could be made ready.</exception>
    protected override async Task PrepareAsync(T settings, CancellationToken ct)
    {
        await base.PrepareAsync(settings, ct);

        var ready = await engine.EnsureRunningAsync(ct);

        if (!ready.Ok)
        {
            throw new CliException(CliExitCode.EngineUnavailable, ready.FailureMessage ?? "The TeensyROM engine isn't running.");
        }
    }
}

/// <summary>
/// A command that works with one online TeensyROM: after the engine is ready the device is chosen and selected, and
/// for <see cref="StorageSettings"/> the storage is chosen for this invocation without saving it.
/// </summary>
internal abstract class DeviceCommand<T>(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService) : EngineCommand<T>(output, engine) where T : DeviceSettings
{
    /// <exception cref="CliException"><see cref="CliExitCode.NoDevice"/> or <see cref="CliExitCode.NotFound"/> when no device can be chosen.</exception>
    protected override async Task PrepareAsync(T settings, CancellationToken ct)
    {
        await base.PrepareAsync(settings, ct);

        if (!NeedsDevice(settings)) return;

        devices.Select(await chooser.ChooseAsync(settings.Device, DeviceScope.Online, ct));

        if (settings is StorageSettings withStorage) storage.UseStorage(ChooseStorage(withStorage));
    }

    /// <summary>Whether this run works with one device; a command that acts on every device says no and none is chosen.</summary>
    protected virtual bool NeedsDevice(T settings) => true;

    /// <summary>
    /// Warns, after the command's results, when tr-web holds no full index of the chosen storage: search and random only
    /// see the files it has cached until one is built. Does nothing for an indexed storage.
    /// </summary>
    protected void NoticeWhenIndexIncomplete()
    {
        if (devices.SelectedDevice is not { } device || device.IsIndexed(storage.StorageType)) return;

        var storageName = storage.StorageType == TeensyStorageType.USB ? "usb" : "sd";
        var deviceArgument = device.Name.Any(char.IsWhiteSpace) ? $"\"{device.Name}\"" : device.Name;
        var fix = $"trom index build --device {deviceArgument} --storage {storageName}";

        Output.Notice(new CliNotice(
            "indexIncomplete",
            $"{device.Name}'s {storageName.ToUpperInvariant()} storage hasn't been fully indexed, so results may be incomplete — run `{fix}`.",
            device.Name,
            device.Id,
            storageName,
            fix));
    }

    private TeensyStorageType ChooseStorage(StorageSettings settings) =>
        string.IsNullOrWhiteSpace(settings.Storage)
            ? settingsService.GetSettings().StorageType
            : settings.Storage.Equals("usb", StringComparison.OrdinalIgnoreCase) ? TeensyStorageType.USB : TeensyStorageType.SD;
}
