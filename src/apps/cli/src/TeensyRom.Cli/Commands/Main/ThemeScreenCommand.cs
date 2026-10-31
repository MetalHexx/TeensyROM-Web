using Spectre.Console;
using Spectre.Console.Cli;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Themes;

namespace TeensyRom.Cli.Commands.Main;

/// <summary>
/// The Theme screen of the menu: the seven menu colors of a TeensyROM's theme with swatches, edited on screen and sent to
/// the devices only when the user applies them.
/// </summary>
internal class ThemeScreenCommand(IThemeService themes, IDeviceService devices) : AsyncCommand<ThemeScreenSettings>
{
    private const string ChangeColor = "Change a color";
    private const string SwitchTheme = "Switch theme";
    private const string Apply = "Apply";
    private const string SaveAsNew = "Save as new theme";
    private const string LeaveTheme = "Leave Theme";
    private const string Back = "Back";
    private const string KeepCurrent = "Keep current";

    /// <summary>What the screen shows and edits during one visit; each visit starts from a new one.</summary>
    private sealed class ScreenState(ThemeColors rows, ThemeDto? source)
    {
        public ThemeColors Rows { get; set; } = rows;

        public ThemeDto? Source { get; set; } = source;

        public ThemeColors Start { get; set; } = rows;

        public bool Edited => Rows != Start;
    }

    public override async Task<int> ExecuteAsync(CommandContext context, ThemeScreenSettings settings)
    {
        var state = await OpenAsync();

        if (state is null) return 1;

        string choice;

        do
        {
            Draw(state);

            var custom = state.Source is { Kind: ThemeKind.Custom } ? state.Source : null;
            var overwrite = custom is null ? null : $"Overwrite \"{custom.Name}\"";
            var delete = custom is null ? null : $"Delete \"{custom.Name}\"";
            var choices = new List<string> { ChangeColor, SwitchTheme, Apply, SaveAsNew };

            if (custom is not null) choices.AddRange([overwrite!, delete!]);
            choices.Add(LeaveTheme);

            choice = PromptHelper.FilePrompt("Choose wisely", choices);

            try
            {
                if (choice == ChangeColor) ChangeColorOf(state);
                else if (choice == SwitchTheme) await SwitchThemeAsync(state);
                else if (choice == Apply) await ApplyAsync(state);
                else if (choice == SaveAsNew) await SaveAsync(state);
                else if (custom is not null && choice == overwrite) await OverwriteAsync(state, custom);
                else if (custom is not null && choice == delete) await DeleteAsync(state, custom);
            }
            catch (TeensyApiException ex)
            {
                RadHelper.WriteError(ex.Message);
            }
        } while (choice != LeaveTheme);

        RadHelper.WriteLine();
        return 0;
    }

    /// <summary>
    /// The first online device's recorded colors, with the listed theme they still match as the source; with no online
    /// device, the factory theme. Null when there is nothing to open on.
    /// </summary>
    private async Task<ScreenState?> OpenAsync()
    {
        var listed = await themes.ListAsync(CancellationToken.None);
        var online = (await devices.GetDevicesAsync(CancellationToken.None)).FirstOrDefault(device => device.IsOnline);

        if (online is not null)
        {
            var record = await themes.GetDeviceRecordAsync(online.Id, CancellationToken.None);

            return new ScreenState(ThemeColors.From(record.Colors), ThemeColors.MatchingTheme(record, listed));
        }

        var fallback = listed.FirstOrDefault(theme => theme.Id == ThemeColors.FactoryThemeId) ?? listed.FirstOrDefault();

        if (fallback is null)
        {
            RadHelper.WriteError("tr-web has no themes to show.");
            return null;
        }
        return new ScreenState(ThemeColors.From(fallback.Parts.Device), fallback);
    }

    // ---- the screen --------------------------------------------------------------------------------------------------

    private static void Draw(ScreenState state)
    {
        RadHelper.WriteMenu("Theme", "Tune your C64's menu colors.");

        var header = state.Source is null
            ? "Theme: Unsaved colors"
            : $"Theme: {state.Source.Name}  ({(state.Source.Kind == ThemeKind.Shipped ? "shipped" : "custom")}{(state.Edited ? ", edited" : "")})";

        AnsiConsole.Write(new Text(header));
        AnsiConsole.WriteLine();
        AnsiConsole.WriteLine();

        var table = new Table().BorderColor(RadHelper.Theme.Secondary.Color).Border(TableBorder.Rounded).HideHeaders();

        table.AddColumn("Setting").AddColumn("Swatch").AddColumn("Color").AddColumn("Changed");

        foreach (var slot in ThemeSlots.All)
        {
            var color = C64Palette.Get(state.Rows[slot]);
            var changed = state.Rows[slot] != state.Start[slot];

            table.AddRow(
                new Text(ThemeSlots.Label(slot)),
                new Markup($"[{color.Hex}]██[/]"),
                new Text(color.Name),
                new Text(changed ? "changed" : "", new Style(RadHelper.Theme.Secondary.Color)));
        }
        AnsiConsole.Write(table);
        AnsiConsole.WriteLine();
    }

    private static void WriteOutcome(string line, Color? color = null)
    {
        AnsiConsole.Write(new Text(line, color is null ? Style.Plain : new Style(color.Value)));
        AnsiConsole.WriteLine();
    }

    // ---- the actions -------------------------------------------------------------------------------------------------

    private static void ChangeColorOf(ScreenState state)
    {
        var slots = ThemeSlots.All.ToDictionary(slot => $"{ThemeSlots.Label(slot)} ({C64Palette.Get(state.Rows[slot]).Name})");
        var picked = PromptHelper.FilePrompt("Change", [.. slots.Keys, Back]);

        if (picked == Back) return;

        var slot = slots[picked];
        var result = SwatchChoicePrompt.Show(AnsiConsole.Console, ThemeSlots.Label(slot), C64Palette.Get(state.Rows[slot]));

        if (result.Color is not null) state.Rows = state.Rows.With(slot, result.Color.Index);
    }

    private async Task SwitchThemeAsync(ScreenState state)
    {
        var listed = await themes.ListAsync(CancellationToken.None);
        var picked = PromptHelper.FilePrompt("Switch to", [.. listed.Select(theme => theme.Name), KeepCurrent]);

        if (picked == KeepCurrent) return;

        var theme = listed.First(candidate => candidate.Name == picked);

        state.Source = theme;
        state.Rows = ThemeColors.From(theme.Parts.Device);
        state.Start = state.Rows;
    }

    private async Task ApplyAsync(ScreenState state)
    {
        var online = (await devices.GetDevicesAsync(CancellationToken.None)).Where(device => device.IsOnline).ToList();

        if (online.Count == 0)
        {
            RadHelper.WriteError("No TeensyROM is online. Connect one, then run `trom device discover`.");
            return;
        }
        var targets = online.Count == 1 ? online : PickTargets(online);
        var request = new ThemeApplyRequest(state.Rows, state.Source?.Id, new Dictionary<ThemeSlot, int>());

        foreach (var outcome in await themes.ApplyAsync(targets, request, CancellationToken.None))
        {
            var name = outcome.Device.Name;

            switch (outcome.Status)
            {
                case ThemeApplyStatus.Applied:
                    WriteOutcome($"{name}: applied, and the C64 was reset.");
                    if (!outcome.IsRecorded) WriteOutcome($"{name}: these colors were not recorded for the device.");
                    break;
                case ThemeApplyStatus.Busy:
                    WriteOutcome($"{name}: busy with a transfer, so nothing was applied. {outcome.Message}".TrimEnd(), RadHelper.Theme.Error.Color);
                    break;
                default:
                    WriteOutcome($"{name}: failed. {outcome.Message}".TrimEnd(), RadHelper.Theme.Error.Color);
                    break;
            }
        }
        AnsiConsole.WriteLine();
    }

    private static IReadOnlyList<DeviceSummary> PickTargets(IReadOnlyList<DeviceSummary> online)
    {
        var all = $"All online devices ({online.Count})";
        var labels = online.ToDictionary(device => online.Count(other => other.Name == device.Name) > 1 ? $"{device.Name} ({device.Id})" : device.Name);
        var picked = PromptHelper.FilePrompt("Apply to", [all, .. labels.Keys]);

        return picked == all ? online : [labels[picked]];
    }

    private async Task SaveAsync(ScreenState state)
    {
        var name = PromptHelper.RequiredLengthTextPrompt("Theme name", 1).Trim();
        var saved = await themes.CreateAsync(name, state.Rows, CancellationToken.None);

        state.Source = saved;
        state.Start = state.Rows;
    }

    private async Task OverwriteAsync(ScreenState state, ThemeDto source)
    {
        await themes.UpdateAsync(source.Id, source.Name, state.Rows, CancellationToken.None);
        state.Start = state.Rows;
    }

    private async Task DeleteAsync(ScreenState state, ThemeDto source)
    {
        if (!PromptHelper.Confirm(Markup.Escape($"Delete {source.Name}?"), false)) return;

        await themes.DeleteAsync(source.Id, CancellationToken.None);
        state.Source = null;
    }
}
