using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Commands.File;

internal sealed class FileUploadSettings : StorageSettings
{
    [CommandArgument(0, "[LOCAL_PATHS]")]
    [Description("Files or folders on this computer; none sends the current folder's contents. Use - to read them from stdin.")]
    public string[] LocalPaths { get; set; } = [];

    [CommandOption("--to <DEVICE_FOLDER>")]
    [Description("The folder on the TeensyROM the files land in, such as /games. Required.")]
    public string? To { get; set; }

    [CommandOption("--launch")]
    [Description("Launch the file once it's on the TeensyROM. Takes exactly one launchable file, not a folder or an archive.")]
    public bool Launch { get; set; }

    [CommandOption("-y|--yes")]
    [Description("Send the current folder without asking, when no paths are given.")]
    public bool Yes { get; set; }

    public override ValidationResult Validate()
    {
        if (string.IsNullOrWhiteSpace(To))
        {
            return ValidationResult.Error("--to is required: the folder on the TeensyROM the files land in, such as /games.");
        }
        if (!To.IsValidUnixPath()) return ValidationResult.Error($"--to must be a valid unix path, such as /games, not '{To}'.");

        if (Launch && LocalPaths.Length == 0)
        {
            return ValidationResult.Error("--launch needs the one file to launch, such as `trom file upload --launch x.prg --to /games`.");
        }
        if (Launch && LocalPaths.Length != 1) return ValidationResult.Error(LaunchTakesOne(LocalPaths.Length));

        return base.Validate();
    }

    internal static string LaunchTakesOne(int count) =>
        $"--launch takes exactly one file, but {count} paths were given: it launches the file once it's on the TeensyROM, and a TeensyROM runs one file at a time.";
}

/// <summary>
/// <c>trom file upload [LOCAL_PATHS] --to &lt;DEVICE_FOLDER&gt;</c>: copies local files and folders to the TeensyROM in
/// one transfer job and reports each file. With no paths the current folder's contents are sent, after asking unless
/// <c>--yes</c>. With <c>--launch</c> the one file is launched once it has landed.
/// </summary>
/// <remarks>
/// Everything local (stdin, walking the sources, the <c>--launch</c> checks, the confirmation) happens before the engine
/// starts, so a usage error or a "no" never launches it. The exit code follows <see cref="BatchOutcome"/>. Ctrl+C cancels
/// the job, which releases the device, and ends with exit code 1.
/// </remarks>
internal sealed class FileUploadCommand(
    ICliOutput output,
    IEngineControl engine,
    IDeviceChooser chooser,
    IDeviceService devices,
    IStorageService storage,
    ISettingsService settingsService,
    IPlayerService player,
    IStdinPaths stdin,
    UploadRunner runner) : DeviceCommand<FileUploadSettings>(output, engine, chooser, devices, storage, settingsService)
{
    private const string UnsupportedMessage = "not a file type the TeensyROM takes";

    private UploadPlan _plan = new([], [], [], []);

    /// <exception cref="CliException">
    /// <see cref="CliExitCode.Usage"/> for a refused <c>--launch</c> or no names where nothing can be asked;
    /// <see cref="CliExitCode.Failed"/> when the confirmation is declined.
    /// </exception>
    protected override async Task PrepareAsync(FileUploadSettings settings, CancellationToken ct)
    {
        var named = stdin.Expand(settings.LocalPaths);
        var current = Directory.GetCurrentDirectory();

        if (settings.Launch) RequireLaunchable(named, current);

        var ask = named.Count == 0 && !settings.Yes;

        if (ask && !Output.CanPrompt)
        {
            throw new CliException(CliExitCode.Usage, $"No files were named. Name what to upload (use . for the current folder), or pass --yes to send everything in {current}.");
        }
        _plan = UploadSources.Resolve(named, current);

        if (_plan.SkippedByType > 0)
        {
            Output.Notice($"{_plan.SkippedByType} {(_plan.SkippedByType == 1 ? "file was" : "files were")} left out: not a file type the TeensyROM takes.");
        }

        if (ask && _plan.Files.Count > 0) ConfirmCurrentFolder(current, settings.To!);

        // With nothing to send there is nothing for the engine to do.
        if (_plan.Files.Count > 0) await base.PrepareAsync(settings, ct);
    }

    protected override async Task<int> RunAsync(CommandContext context, FileUploadSettings settings, CancellationToken ct)
    {
        if (_plan.Files.Count == 0) return NothingToSend();

        var to = settings.To!;

        var run = await CommandRun.CancellableAsync(token => TransferAsync(to, token));
        var job = run.Job;
        var report = BuildReport(to, run);
        var succeeded = report.Totals.Failed == 0 && job.State == TransferJobState.Completed;

        if (settings.Launch && succeeded) return await LaunchAsync(DevicePath(to, _plan.Files[0].RelativePath));

        CopyResults.Show(Output, report);

        if (job.State is TransferJobState.Aborted or TransferJobState.Abandoned && !string.IsNullOrWhiteSpace(job.Error)) Output.Notice(job.Error);

        var exitCode = BatchOutcome.Finish(
            Output,
            report.Totals.Copied + report.Totals.Failed,
            report.Totals.Failed,
            job.FilesFailed + run.Rejected.Count + _plan.Unsupported.Count > 0,
            "files");

        if (exitCode != 0 || job.State == TransferJobState.Completed) return exitCode;

        // The job ended without sending everything, yet nothing is recorded as failed.
        Output.Error(new CliException(CliExitCode.Failed, "The transfer ended before every file was sent."));
        return (int)CliExitCode.Failed;
    }

    /// <summary>Refuses, before anything starts, a <c>--launch</c> that isn't one existing, launchable, non-archive file.</summary>
    private static void RequireLaunchable(IReadOnlyList<string> named, string current)
    {
        if (named.Count != 1) throw new CliException(CliExitCode.Usage, FileUploadSettings.LaunchTakesOne(named.Count));

        var full = Path.GetFullPath(named[0], current);

        if (Directory.Exists(full))
        {
            throw new CliException(CliExitCode.Usage, $"--launch takes a file, but {named[0]} is a folder: only a single file can be launched once it's on the TeensyROM.");
        }
        if (!System.IO.File.Exists(full)) throw new CliException(CliExitCode.Usage, $"--launch takes an existing file, and {named[0]} wasn't found.");

        var fileName = Path.GetFileName(full);

        if (UploadSources.IsArchive(fileName))
        {
            throw new CliException(CliExitCode.Usage, $"--launch can't launch {fileName}: an archive is expanded on the TeensyROM, so name the file inside it instead.");
        }
        if (FileItem.Create(fileName) is not ILaunchableItem)
        {
            throw new CliException(CliExitCode.Usage, $"--launch can't launch {fileName}: the TeensyROM only launches music, games and programs.");
        }
    }

    private void ConfirmCurrentFolder(string current, string to)
    {
        var count = _plan.Files.Count;
        var question = $"Send {count} {(count == 1 ? "file" : "files")} ({UploadSources.FormatSize(_plan.TotalSize)}) from {current} to {to} on the TeensyROM?";

        if (!Output.Err.Confirm(Markup.Escape(question), defaultValue: false))
        {
            throw new CliException(CliExitCode.Failed, "Cancelled; nothing was sent.");
        }
    }

    /// <summary>
    /// Nothing is left to send: the named paths that don't exist and the named files of a type the TeensyROM doesn't take
    /// are the results, or the folders held nothing it takes.
    /// </summary>
    private int NothingToSend()
    {
        if (_plan.NotFound.Count == 0 && _plan.Unsupported.Count == 0)
        {
            var where = string.Join(", ", _plan.Folders);

            throw new CliException(
                CliExitCode.NotFound,
                _plan.SkippedByType > 0 ? $"There's nothing to upload in {where}: none of its files are a file type the TeensyROM takes." : $"There's nothing to upload in {where}.");
        }
        var results = _plan.NotFound.Select(path => CopyResults.Failed(path, string.Empty, CopyResults.NotFoundMessage))
            .Concat(_plan.Unsupported.Select(path => CopyResults.Failed(path, string.Empty, UnsupportedMessage)))
            .ToList();

        CopyResults.Show(Output, new CopyReportJson(results, new CopyTotalsJson(0, results.Count)));

        return BatchOutcome.Finish(Output, results.Count, results.Count, anyFailedForOtherReasons: _plan.Unsupported.Count > 0, "files");
    }

    /// <summary>Runs the job, with a live progress line on stderr when a person is watching one.</summary>
    private Task<UploadRunResult> TransferAsync(string to, CancellationToken ct) =>
        CommandRun.WithStatusAsync<UploadProgress, UploadRunResult>(
            Output, "Starting the transfer...", Describe, progress => runner.RunAsync(storage.StorageType, to, _plan.Files, progress, ct));

    private static string Describe(UploadProgress progress) =>
        $"Sending {progress.Sent}/{progress.Total}, {progress.Failed} failed" + (string.IsNullOrEmpty(progress.CurrentFile) ? string.Empty : $" — {progress.CurrentFile}");

    /// <summary>
    /// One result per local file, then one per failure the job recorded that matches none (a file inside an archive),
    /// then one per named path that doesn't exist, then one per named file of an unsupported type. A job failure is matched to a file by its path under the destination.
    /// </summary>
    private CopyReportJson BuildReport(string to, UploadRunResult run)
    {
        var job = run.Job;
        var rejections = run.Rejected.GroupBy(rejection => rejection.File).ToDictionary(group => group.Key, group => group.First().Message);
        var failures = job.Failures.ToLookup(failure => failure.RelativePath, StringComparer.OrdinalIgnoreCase);
        var results = new List<CopyResultJson>();

        foreach (var file in _plan.Files)
        {
            var devicePath = DevicePath(to, file.RelativePath);

            if (rejections.TryGetValue(file, out var rejection)) results.Add(CopyResults.Failed(file.LocalPath, devicePath, rejection));
            else if (failures[file.RelativePath].FirstOrDefault() is { } failure) results.Add(CopyResults.Failed(file.LocalPath, devicePath, FailureMessage(failure)));
            else results.Add(CopyResults.Copied(file.LocalPath, devicePath));
        }
        var localPaths = _plan.Files.Select(file => file.RelativePath).ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var failure in job.Failures.Where(failure => !localPaths.Contains(failure.RelativePath)))
        {
            results.Add(CopyResults.Failed(ArchiveOf(failure), failure.TargetPath, FailureMessage(failure)));
        }
        results.AddRange(_plan.NotFound.Select(path => CopyResults.Failed(path, string.Empty, CopyResults.NotFoundMessage)));
        results.AddRange(_plan.Unsupported.Select(path => CopyResults.Failed(path, string.Empty, UnsupportedMessage)));

        return new CopyReportJson(results, new CopyTotalsJson(job.FilesSent, job.FilesFailed + run.Rejected.Count + _plan.NotFound.Count + _plan.Unsupported.Count));
    }

    private static string FailureMessage(TransferFileCompleted failure) =>
        string.IsNullOrWhiteSpace(failure.Error) ? "The TeensyROM couldn't take the file." : failure.Error;

    /// <summary>
    /// The local archive a failure inside it belongs to: tr-web expands <c>pack.zip</c> into <c>pack/</c>, so the failure's
    /// path starts there. A failure that names no archive is put to the only one, else shown by its own path.
    /// </summary>
    private string ArchiveOf(TransferFileCompleted failure)
    {
        var archives = _plan.Files.Where(file => file.IsArchive).ToList();
        var owner = archives
            .Where(archive => failure.RelativePath.StartsWith(Path.ChangeExtension(archive.RelativePath, null) + "/", StringComparison.OrdinalIgnoreCase))
            .MaxBy(archive => archive.RelativePath.Length);

        return owner?.LocalPath ?? (archives.Count == 1 ? archives[0].LocalPath : failure.RelativePath);
    }

    private async Task<int> LaunchAsync(string devicePath)
    {
        var item = await storage.GetFile(devicePath)
            ?? throw new CliException(CliExitCode.NotFound, $"{devicePath} wasn't found on the TeensyROM after the upload.");

        player.UseStorage(storage.StorageType);

        return new LaunchReport(Output).Report(await player.LaunchOnceAsync(item), storage.StorageType, $"{devicePath} wasn't found.");
    }

    private static string DevicePath(string to, string relativePath) => $"{to.TrimEnd('/')}/{relativePath}";
}
