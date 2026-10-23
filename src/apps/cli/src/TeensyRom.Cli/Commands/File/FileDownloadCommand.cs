using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Commands.File;

internal sealed class FileDownloadSettings : StorageSettings
{
    [CommandArgument(0, "<DEVICE_PATHS>")]
    [Description("The files and folders on the TeensyROM to copy, such as /games. Use - to read them from stdin, one per line.")]
    public string[] Paths { get; set; } = [];

    [CommandOption("--to <LOCAL_FOLDER>")]
    [Description("The folder on this computer to save into; defaults to the current folder. Created if missing.")]
    public string? To { get; set; }

    public override ValidationResult Validate()
    {
        var invalid = Paths.Select(FileCommandOptions.ValidatePath).FirstOrDefault(result => !result.Successful);

        return invalid ?? base.Validate();
    }
}

/// <summary>
/// <c>trom file download &lt;DEVICE_PATHS&gt; [--to &lt;LOCAL_FOLDER&gt;]</c>: copies files and folders from the TeensyROM to
/// this computer and reports each file. A folder arrives as a folder of its own name with its layout kept; <c>/</c>
/// saves its contents straight into the target.
/// </summary>
/// <remarks>
/// The exit code follows <see cref="BatchOutcome"/>. Ctrl+C stops after the file in flight is discarded and ends with exit
/// code 1. See <see cref="DownloadRunner"/> for how names are made safe and files are written.
/// </remarks>
internal sealed class FileDownloadCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IStdinPaths stdin,
    DownloadRunner runner) : DeviceCommand<FileDownloadSettings>(output, engine, chooser, devices, storage, settingsService)
{
    private IReadOnlyList<string> _paths = [];

    /// <exception cref="CliException"><see cref="CliExitCode.Usage"/> when a path read from stdin isn't a valid unix path.</exception>
    protected override async Task PrepareAsync(FileDownloadSettings settings, CancellationToken ct)
    {
        _paths = stdin.Expand(settings.Paths);

        var invalid = _paths.FirstOrDefault(path => !path.IsValidUnixPath());
        if (invalid is not null) throw new CliException(CliExitCode.Usage, $"'{invalid}' is not a valid unix path, such as /music.");

        await base.PrepareAsync(settings, ct);
    }

    protected override async Task<int> RunAsync(CommandContext context, FileDownloadSettings settings, CancellationToken ct)
    {
        var target = Path.GetFullPath(string.IsNullOrWhiteSpace(settings.To) ? Directory.GetCurrentDirectory() : settings.To);

        try
        {
            Directory.CreateDirectory(target);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            throw new CliException(CliExitCode.Failed, $"Couldn't create {target}: {error.Message}");
        }
        using var cancel = new CancellationTokenSource();
        ConsoleCancelEventHandler onCancel = (_, args) =>
        {
            args.Cancel = true;
            cancel.Cancel();
        };

        Console.CancelKeyPress += onCancel;

        DownloadRunResult run;

        try
        {
            run = await TransferAsync(target, cancel.Token);
        }
        finally
        {
            Console.CancelKeyPress -= onCancel;
        }
        var failed = run.Results.Count(result => !result.Ok);
        var report = new CopyReportJson(run.Results, new CopyTotalsJson(run.Results.Count - failed, failed));

        CopyResults.Show(Output, report);

        return BatchOutcome.Finish(Output, run.Results.Count, failed, run.AnyFailedForOtherReasons, "files");
    }

    /// <summary>Runs the download, with a live progress line on stderr when a person is watching one.</summary>
    private async Task<DownloadRunResult> TransferAsync(string target, CancellationToken ct)
    {
        if (Output.Mode != OutputMode.Human || !Output.ErrIsTerminal) return await runner.RunAsync(_paths, target, null, ct);

        DownloadRunResult? run = null;

        await Output.Err.Status().Spinner(Spinner.Known.Dots).StartAsync("Starting the download...", async status =>
            run = await runner.RunAsync(_paths, target, progress => status.Status = Markup.Escape(Describe(progress)), ct));

        return run!;
    }

    private static string Describe(DownloadProgress progress) =>
        $"Saved {progress.Saved}, {progress.Failed} failed" + (string.IsNullOrEmpty(progress.CurrentFile) ? string.Empty : $" — {progress.CurrentFile}");
}
