using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Commands.File;

internal sealed class FileSearchSettings : StorageSettings
{
    [CommandArgument(0, "<TEXT>")]
    [Description("What to search for. Quote it when it has spaces.")]
    public string Text { get; set; } = string.Empty;

    [CommandOption("-f|--filter <FILTER>")]
    [Description("Only these files: all, games, music, images or hex. Defaults to all.")]
    public string? Filter { get; set; }

    [CommandOption("--take <COUNT>")]
    [Description("The most results to show. Defaults to 50.")]
    public int Take { get; set; } = 50;

    [CommandOption("--full")]
    [Description("Write every file's full metadata in JSON, as file launch does.")]
    public bool Full { get; set; }

    public override ValidationResult Validate()
    {
        if (string.IsNullOrWhiteSpace(Text)) return ValidationResult.Error("Search text can't be empty.");

        if (Take < 1) return ValidationResult.Error("--take must be at least 1.");

        var filter = FileCommandOptions.Check(() => FileCommandOptions.ParseFilter(Filter));

        return filter.Successful ? base.Validate() : filter;
    }
}

/// <summary>
/// <c>trom file search &lt;TEXT&gt;</c>: the first <c>--take</c> results of a search on one storage. Piped, it writes one
/// path per line.
/// </summary>
internal sealed class FileSearchCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService) : DeviceCommand<FileSearchSettings>(output, engine, chooser, devices, storage, settingsService)
{
    protected override async Task<int> RunAsync(CommandContext context, FileSearchSettings settings, CancellationToken ct)
    {
        var found = await storage.Search(settings.Text, FileCommandOptions.ParseFilter(settings.Filter));
        var items = found.Take(settings.Take).ToList();
        var results = items.Select(file => FileItemJson.From(file, storage.StorageType)).ToList();

        switch (Output.Mode)
        {
            case OutputMode.Json:
                IReadOnlyList<object> json = settings.Full
                    ? items.Select(file => (object)FileItemJson.Full(file, storage.StorageType)).ToList()
                    : results;
                Output.Json(json);
                break;
            case OutputMode.Plain:
                Output.Lines(results.Select(file => file.Path));
                break;
            default:
                if (results.Count > 0) Output.Out.Write(ToTable(results));
                break;
        }

        if (results.Count == 0) Output.Notice("No files matched.");

        NoticeWhenIndexIncomplete();

        return 0;
    }

    private static Table ToTable(IReadOnlyList<FileItemJson> results)
    {
        var table = new Table().BorderColor(RadHelper.Theme.Secondary.Color).Border(TableBorder.Rounded);

        table.AddColumn("Name");
        table.AddColumn("Type");
        table.AddColumn("Path");

        foreach (var file in results) table.AddRow(new Text(file.Name), new Text(file.FileType.ToString()), new Text(file.Path));

        return table;
    }
}
