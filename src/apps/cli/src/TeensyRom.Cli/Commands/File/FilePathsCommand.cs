using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Commands.File;

/// <summary>The paths of a <c>file</c> command that works through many of them.</summary>
internal sealed class FilePathsSettings : StorageSettings
{
    [CommandArgument(0, "<PATHS>")]
    [Description("The files to work on. Use - to read every path from stdin, one per line.")]
    public string[] Paths { get; set; } = [];

    public override ValidationResult Validate()
    {
        var invalid = Paths.Select(FileCommandOptions.ValidatePath).FirstOrDefault(result => !result.Successful);

        return invalid ?? base.Validate();
    }
}

/// <summary>What happened to one path of a <c>file favorite|unfavorite|ban</c> run, as the JSON array carries it.</summary>
internal record FilePathResultJson(string Path, bool Ok, string Message);

/// <summary>A ban's result: the name now banned, and whether it already was.</summary>
internal sealed record FileBanResultJson(string Path, bool Ok, string Message, string BannedFileName, bool AlreadyBanned)
    : FilePathResultJson(Path, Ok, Message);

/// <summary>
/// Runs one operation over every path, from arguments or stdin, and reports each path's result. A failing path never
/// stops the rest.
/// </summary>
/// <remarks>
/// The exit code is 0 when every path succeeded, 1 when any path failed for a reason other than not being found, and
/// otherwise 5 (every failure was a not-found). Piped, stdout carries the paths that succeeded, one per line.
/// </remarks>
internal abstract class FilePathsCommand<TResult>(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IStdinPaths stdin) : DeviceCommand<FilePathsSettings>(output, engine, chooser, devices, storage, settingsService)
    where TResult : FilePathResultJson
{
    /// <summary>Works on one validated path; a thrown error becomes that path's failure.</summary>
    protected abstract Task<TResult> ProcessAsync(string path);

    /// <summary>The result to report for a path that failed with <paramref name="message"/>.</summary>
    protected abstract TResult Failure(string path, string message);

    protected override async Task<int> RunAsync(CommandContext context, FilePathsSettings settings, CancellationToken ct)
    {
        var paths = stdin.Expand(settings.Paths);

        var invalid = paths.FirstOrDefault(path => !path.IsValidUnixPath());
        if (invalid is not null) throw new CliException(CliExitCode.Usage, $"'{invalid}' is not a valid unix path, such as /music.");

        var results = new List<TResult>();
        var failedForOtherReasons = false;

        foreach (var path in paths)
        {
            try
            {
                results.Add(await ProcessAsync(path));
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                var mapped = ExitCodeMapper.Map(error);

                results.Add(Failure(path, mapped.Message));
                failedForOtherReasons |= mapped.Code != CliExitCode.NotFound;
            }
        }
        Show(results);

        return BatchOutcome.Finish(Output, results.Count, results.Count(result => !result.Ok), failedForOtherReasons, "paths");
    }

    private void Show(IReadOnlyList<TResult> results)
    {
        switch (Output.Mode)
        {
            case OutputMode.Json:
                Output.Json(results);
                break;
            case OutputMode.Plain:
                Output.Lines(results.Where(result => result.Ok).Select(result => result.Path));
                foreach (var result in results.Where(result => !result.Ok)) Output.Notice($"{result.Path}: {result.Message}");
                break;
            default:
                var table = new Table().BorderColor(RadHelper.Theme.Secondary.Color).Border(TableBorder.Rounded);

                table.AddColumn("Path");
                table.AddColumn("Result");

                foreach (var result in results) table.AddRow(new Text(result.Path), new Text(result.Ok ? result.Message : $"Failed: {result.Message}"));

                Output.Out.Write(table);
                break;
        }
    }
}
