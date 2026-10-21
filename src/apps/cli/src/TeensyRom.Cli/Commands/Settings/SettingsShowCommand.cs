using Spectre.Console;
using Spectre.Console.Cli;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Commands.Settings;

internal sealed class SettingsShowSettings : TromSettings;

/// <summary>The CLI's own settings as the settings verbs write them: <c>storage</c> as <c>sd</c> or <c>usb</c>.</summary>
internal sealed record SettingsView(string Storage, bool AlwaysPromptStorage, bool DebugLogs)
{
    public static SettingsView From(TeensySettings settings) => new(
        settings.StorageType.ToString().ToLowerInvariant(),
        settings.AlwaysPromptStorage,
        settings.EnableDebugLogs);
}

/// <summary>
/// <c>trom settings show</c>: the CLI's saved settings. Reads only; it never starts the engine.
/// </summary>
internal sealed class SettingsShowCommand(ICliOutput output, ISettingsService settingsService) : TromCommand<SettingsShowSettings>(output)
{
    protected override Task<int> RunAsync(CommandContext context, SettingsShowSettings settings, CancellationToken ct)
    {
        var view = SettingsView.From(settingsService.GetSettings());

        switch (Output.Mode)
        {
            case OutputMode.Json:
                Output.Json(view);
                break;
            case OutputMode.Plain:
                Output.Fields(Fields(view));
                break;
            default:
                Output.Out.Write(ToTable(view));
                break;
        }
        return Task.FromResult(0);
    }

    private static IReadOnlyList<(string Label, string Value)> Fields(SettingsView view) =>
    [
        ("storage", view.Storage),
        ("alwaysPromptStorage", Bool(view.AlwaysPromptStorage)),
        ("debugLogs", Bool(view.DebugLogs))
    ];

    private static Table ToTable(SettingsView view)
    {
        var table = new Table().BorderColor(RadHelper.Theme.Secondary.Color).Border(TableBorder.Rounded)
            .AddColumn("Setting")
            .AddColumn("Value")
            .AddColumn("Description");

        table.AddRow(new Text("Storage Device"), new Text(view.Storage), new Text("Default value to use for your selected storage device."));
        table.AddRow(new Text("Always Prompt Storage"), new Text(Bool(view.AlwaysPromptStorage)), new Text("Determines if you're always prompted to select the storage device."));
        table.AddRow(new Text("Debug Logs Enabled"), new Text(Bool(view.DebugLogs)), new Text("Enables verbose logs for debugging."));

        return table;
    }

    private static string Bool(bool value) => value ? "true" : "false";
}
