using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Commands.Settings;

internal sealed class SettingsSetSettings : TromSettings
{
    [CommandArgument(0, "<KEY>")]
    [Description("The setting to change: storage, always-prompt-storage or debug-logs.")]
    public string Key { get; set; } = string.Empty;

    [CommandArgument(1, "<VALUE>")]
    [Description("The new value: sd or usb for storage; true or false for the others.")]
    public string Value { get; set; } = string.Empty;
}

/// <summary>
/// <c>trom settings set &lt;KEY&gt; &lt;VALUE&gt;</c>: changes one of the CLI's saved settings. A bad key or value is a
/// usage error and changes nothing. Never starts the engine.
/// </summary>
internal sealed class SettingsSetCommand(ICliOutput output, ISettingsService settingsService, ICliLoggingService logService) : TromCommand<SettingsSetSettings>(output)
{
    private const string StorageKey = "storage";
    private const string AlwaysPromptKey = "always-prompt-storage";
    private const string DebugLogsKey = "debug-logs";

    protected override Task<int> RunAsync(CommandContext context, SettingsSetSettings args, CancellationToken ct)
    {
        var key = args.Key.ToLowerInvariant();
        var updated = settingsService.GetSettings();
        var value = Apply(updated, key, args.Value);

        if (!settingsService.SaveSettings(updated))
        {
            throw new CliException(CliExitCode.Failed, "Couldn't save the CLI's settings.");
        }
        logService.Enabled = updated.EnableDebugLogs;

        if (Output.Mode == OutputMode.Json) Output.Json(SettingsView.From(updated));
        else Output.Fields([(key, value)]);

        return Task.FromResult(0);
    }

    /// <summary>Applies one setting to <paramref name="settings"/> and returns the value it now holds, as written.</summary>
    private static string Apply(TeensySettings settings, string key, string value)
    {
        switch (key)
        {
            case StorageKey:
                if (!value.IsValidStorageDevice()) throw Invalid(key, value, "sd or usb");
                settings.StorageType = value.Equals("usb", StringComparison.OrdinalIgnoreCase) ? TeensyStorageType.USB : TeensyStorageType.SD;
                return settings.StorageType.ToString().ToLowerInvariant();

            case AlwaysPromptKey:
                settings.AlwaysPromptStorage = ParseBool(key, value);
                return Bool(settings.AlwaysPromptStorage);

            case DebugLogsKey:
                settings.EnableDebugLogs = ParseBool(key, value);
                return Bool(settings.EnableDebugLogs);

            default:
                throw new CliException(CliExitCode.Usage,
                    $"Unknown setting '{key}'. Valid settings: {StorageKey} sd|usb, {AlwaysPromptKey} true|false, {DebugLogsKey} true|false.");
        }
    }

    private static bool ParseBool(string key, string value)
    {
        if (bool.TryParse(value, out var flag)) return flag;

        throw Invalid(key, value, "true or false");
    }

    private static CliException Invalid(string key, string value, string valid) =>
        new(CliExitCode.Usage, $"'{value}' isn't a valid value for {key}. Use {valid}.");

    private static string Bool(bool value) => value ? "true" : "false";
}
