using Spectre.Console;
using Spectre.Console.Cli;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Themes;

namespace TeensyRom.Cli.Commands.ThemeCommands;

/// <summary><c>trom theme list</c>: every shipped and custom theme with its colors. Needs no device.</summary>
internal sealed class ThemeListCommand(ICliOutput output, IEngineControl engine, IThemeService themes)
    : EngineCommand<ThemeListSettings>(output, engine)
{
    protected override async Task<int> RunAsync(CommandContext context, ThemeListSettings settings, CancellationToken ct)
    {
        ThemeOutput.ShowList(Output, (await themes.ListAsync(ct)).Select(ThemeOutput.ToJson).ToList());

        return 0;
    }
}

/// <summary>
/// <c>trom theme show</c>: the colors each known TeensyROM was last given, naming the theme only while they still match it.
/// </summary>
internal sealed class ThemeShowCommand(ICliOutput output, IEngineControl engine, IDeviceChooser chooser, IDeviceService devices, IThemeService themes)
    : EngineCommand<ThemeShowSettings>(output, engine)
{
    protected override async Task<int> RunAsync(CommandContext context, ThemeShowSettings settings, CancellationToken ct)
    {
        IReadOnlyList<DeviceSummary> known = string.IsNullOrWhiteSpace(settings.Device)
            ? await devices.GetDevicesAsync(ct)
            : [await chooser.ChooseAsync(settings.Device, DeviceScope.Known, ct)];
        var shown = new List<DeviceThemeJson>(known.Count);

        if (known.Count > 0)
        {
            var all = await themes.ListAsync(ct);

            foreach (var device in known)
            {
                shown.Add(ThemeOutput.ToJson(device, await themes.GetDeviceRecordAsync(device.Id, ct), all));
            }
        }
        ThemeOutput.ShowDevices(Output, shown);

        return 0;
    }
}

/// <summary>
/// <c>trom theme apply [THEME]</c>: sends a theme and/or single colors to every online TeensyROM, or the one --device
/// names. Each C64 resets, which ends whatever it is running.
/// </summary>
internal sealed class ThemeApplyCommand(ICliOutput output, IEngineControl engine, IDeviceChooser chooser, IDeviceService devices, IThemeService themes)
    : EngineCommand<ThemeApplySettings>(output, engine)
{
    protected override async Task<int> RunAsync(CommandContext context, ThemeApplySettings settings, CancellationToken ct)
    {
        var theme = string.IsNullOrWhiteSpace(settings.Theme) ? null : await themes.FindAsync(settings.Theme, ct);
        var targets = await TargetsAsync(settings, ct);
        var request = theme is null
            ? new ThemeApplyRequest(null, null, settings.Overrides())
            : new ThemeApplyRequest(ThemeColors.From(theme.Parts.Device), theme.Id, settings.Overrides());

        var outcomes = await themes.ApplyAsync(targets, request, ct);

        ThemeOutput.ShowApply(Output, new ThemeApplyJson(
            theme is null ? null : new ThemeRefJson(theme.Id, theme.Name),
            outcomes.Select(ThemeOutput.ToJson).ToList()));

        foreach (var outcome in outcomes.Where(o => o.Status == ThemeApplyStatus.Applied && !o.IsRecorded))
        {
            Output.Notice($"{outcome.Device.Name}'s colors reached the C64, but tr-web couldn't record them, so `trom theme show` won't reflect them.");
        }
        return Finish(outcomes);
    }

    /// <exception cref="CliException"><see cref="CliExitCode.NoDevice"/> when no TeensyROM is online or the one named is offline.</exception>
    private async Task<IReadOnlyList<DeviceSummary>> TargetsAsync(ThemeApplySettings settings, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(settings.Device)) return [await chooser.ChooseAsync(settings.Device, DeviceScope.Online, ct)];

        var online = (await devices.GetDevicesAsync(ct)).Where(device => device.IsOnline).ToList();

        return online.Count > 0
            ? online
            : throw new CliException(CliExitCode.NoDevice, "No TeensyROM is online. Connect one, then run `trom device discover`.");
    }

    /// <summary>0 when every device took the colors; otherwise reports the count and returns the code, without throwing so <c>--json</c> stderr ends with the error object.</summary>
    private int Finish(IReadOnlyList<ThemeApplyOutcome> outcomes)
    {
        var failed = outcomes.Where(outcome => outcome.Status != ThemeApplyStatus.Applied).ToList();

        if (failed.Count == 0) return 0;

        var code = failed.All(outcome => outcome.Status == ThemeApplyStatus.Busy) ? CliExitCode.DeviceBusy : CliExitCode.Failed;

        Output.Error(new CliException(code, $"{failed.Count} of {outcomes.Count} TeensyROMs failed."));

        return (int)code;
    }
}

/// <summary>
/// <c>trom theme save &lt;NAME&gt; [BASE]</c>: saves a custom theme from a base theme or a TeensyROM's current colors,
/// with any color flags laid over it. Needs no device when a base theme is named.
/// </summary>
internal sealed class ThemeSaveCommand(ICliOutput output, IEngineControl engine, IDeviceChooser chooser, IThemeService themes)
    : EngineCommand<ThemeSaveSettings>(output, engine)
{
    protected override async Task<int> RunAsync(CommandContext context, ThemeSaveSettings settings, CancellationToken ct)
    {
        var colors = (await BaseColorsAsync(settings, ct)).With(settings.Overrides());
        var name = settings.Name.Trim();
        var existing = (await themes.ListAsync(ct)).FirstOrDefault(theme => theme.Name.Trim().Equals(name, StringComparison.OrdinalIgnoreCase));

        if (existing?.Kind == ThemeKind.Shipped)
        {
            throw new CliException(CliExitCode.Usage, $"{existing.Name} is a shipped theme and can't be saved over. Choose another name.");
        }
        if (existing is not null && !settings.Overwrite)
        {
            throw new CliException(CliExitCode.Usage, $"A custom theme named {existing.Name} already exists. Pass --overwrite to replace its colors.");
        }
        var saved = existing is null
            ? await themes.CreateAsync(name, colors, ct)
            : await themes.UpdateAsync(existing.Id, name, colors, ct);
        var json = ThemeOutput.ToJson(saved);

        ThemeOutput.ShowTheme(Output, new ThemeSaveJson(existing is not null, json), json);

        return 0;
    }

    private async Task<ThemeColors> BaseColorsAsync(ThemeSaveSettings settings, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(settings.Base)) return ThemeColors.From((await themes.FindAsync(settings.Base, ct)).Parts.Device);

        var scope = string.IsNullOrWhiteSpace(settings.Device) ? DeviceScope.Online : DeviceScope.Known;
        var device = await chooser.ChooseAsync(settings.Device, scope, ct);

        return ThemeColors.From((await themes.GetDeviceRecordAsync(device.Id, ct)).Colors);
    }
}

/// <summary>
/// <c>trom theme delete &lt;NAME&gt;</c>: deletes a custom theme after asking, unless --yes. Devices that were given the
/// theme keep their colors. Needs no device.
/// </summary>
internal sealed class ThemeDeleteCommand(ICliOutput output, IEngineControl engine, IThemeService themes)
    : EngineCommand<ThemeDeleteSettings>(output, engine)
{
    protected override async Task<int> RunAsync(CommandContext context, ThemeDeleteSettings settings, CancellationToken ct)
    {
        var theme = await themes.FindAsync(settings.Name, ct);

        if (theme.Kind == ThemeKind.Shipped) throw new CliException(CliExitCode.Usage, $"{theme.Name} is a shipped theme and can't be deleted.");
        if (!settings.Yes) Confirm(theme.Name);

        await themes.DeleteAsync(theme.Id, ct);

        if (Output.Mode == OutputMode.Json) Output.Json(new ThemeDeleteJson(theme.Id, theme.Name));
        else Output.Notice($"Deleted the theme {theme.Name}.");

        return 0;
    }

    /// <exception cref="CliException"><see cref="CliExitCode.Failed"/> when declined; <see cref="CliExitCode.Usage"/> when there is no terminal to ask in.</exception>
    private void Confirm(string name)
    {
        if (!Output.CanPrompt) throw new CliException(CliExitCode.Usage, $"Pass --yes to delete {name} without a terminal to confirm it.");

        if (!Output.Err.Confirm(Markup.Escape($"Delete the theme {name}?"), defaultValue: false))
        {
            throw new CliException(CliExitCode.Failed, "Cancelled; nothing was deleted.");
        }
    }
}
