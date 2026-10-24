using TeensyRom.Cli.Api;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Commands.File;

/// <summary>How far a download is: what the live progress line shows.</summary>
internal sealed record DownloadProgress(int Saved, int Failed, string? CurrentFile);

/// <summary>What a download run did: one result per file or folder that was tried, and whether any failure was something other than a not-found.</summary>
internal sealed record DownloadRunResult(IReadOnlyList<CopyResultJson> Results, bool AnyFailedForOtherReasons);

/// <summary>
/// Copies device files and folders into a local folder, one file at a time. Every local path comes from
/// <see cref="LocalTargetPath.Resolve"/>, and a file is written beside its final name and moved into place, so a real
/// name never holds a half-written file.
/// </summary>
internal sealed class DownloadRunner(IStorageService storage, ITransferService transfers)
{
    private const int FileBufferSize = 81_920;

    private const string TooLargeMessage = "larger than the 10 MB limit";

    /// <summary>
    /// Saves each of <paramref name="devicePaths"/> under <paramref name="target"/>: a file as its name, a folder as a
    /// folder of its own name with its layout recreated, and <c>/</c> as its contents directly. A failure is that
    /// file's result and the rest carry on.
    /// </summary>
    /// <param name="progress">Told as each file starts and ends.</param>
    /// <exception cref="CliException"><see cref="CliExitCode.Failed"/> when <paramref name="ct"/> is cancelled; no half-written file is left.</exception>
    /// <exception cref="CliException"><see cref="CliExitCode.NotFound"/> when the run produced no results at all, such as a folder with no files in it.</exception>
    public async Task<DownloadRunResult> RunAsync(IReadOnlyList<string> devicePaths, string target, Action<DownloadProgress>? progress, CancellationToken ct)
    {
        var run = new Run(storage, transfers, target, progress);

        try
        {
            foreach (var devicePath in devicePaths) await run.NamedAsync(devicePath, ct);
        }
        catch (Exception) when (ct.IsCancellationRequested)
        {
            // Cancelling surfaces as an OperationCanceledException or, through ApiErrors.Call, a TeensyApiException with no status: never a file's failure.
            throw new CliException(CliExitCode.Failed, "Cancelled; nothing more was saved.");
        }
        if (run.Results.Count == 0)
        {
            throw new CliException(CliExitCode.NotFound, $"There's nothing to download in {string.Join(", ", devicePaths)}.");
        }
        return new DownloadRunResult(run.Results, run.AnyFailedForOtherReasons);
    }

    private sealed class Run(IStorageService storage, ITransferService transfers, string target, Action<DownloadProgress>? progress)
    {
        private int _saved;
        private int _failed;

        public List<CopyResultJson> Results { get; } = [];

        public bool AnyFailedForOtherReasons { get; private set; }

        /// <summary>Classifies a path the user named by listing its parent, then saves it as a folder or a file.</summary>
        public async Task NamedAsync(string devicePath, CancellationToken ct)
        {
            if (devicePath == "/")
            {
                await FolderAsync("/", [], ct);
                return;
            }
            var path = devicePath.TrimEnd('/');
            DirectoryListing listing;

            try
            {
                listing = await storage.GetDirectory(path.GetUnixParentPath());
            }
            catch (Exception error) when (!ct.IsCancellationRequested)
            {
                Fail(string.Empty, devicePath, error);
                return;
            }
            if (listing.Directories.FirstOrDefault(directory => SamePath(directory.Path, path)) is { } folder)
            {
                await FolderAsync(folder.Path, [folder.Name], ct);
            }
            else if (listing.Files.FirstOrDefault(file => SamePath(file.Path, path)) is { } file)
            {
                await FileAsync(file.Path, [file.Name], ct);
            }
            else
            {
                Fail(string.Empty, devicePath, new TeensyApiException(CopyResults.NotFoundMessage, 404));
            }
        }

        private async Task FolderAsync(string devicePath, string[] segments, CancellationToken ct)
        {
            var (folderPath, problem) = segments.Length > 0 ? LocalTargetPath.Resolve(target, segments) : (target, null);
            var wouldBe = WouldBePath(segments);

            if (problem is not null)
            {
                Fail(wouldBe, devicePath, problem, otherReason: true);
                return;
            }
            DirectoryListing listing;

            try
            {
                listing = await storage.GetDirectory(devicePath);
            }
            catch (Exception error) when (!ct.IsCancellationRequested)
            {
                Fail(wouldBe, devicePath, error);
                return;
            }

            if (segments.Length > 0)
            {
                try
                {
                    Directory.CreateDirectory(folderPath!);
                }
                catch (Exception error) when (error is IOException or UnauthorizedAccessException)
                {
                    Fail(folderPath!, devicePath, error);
                    return;
                }
            }

            foreach (var file in listing.Files) await FileAsync(file.Path, [.. segments, file.Name], ct);

            foreach (var directory in listing.Directories) await FolderAsync(directory.Path, [.. segments, directory.Name], ct);
        }

        private async Task FileAsync(string devicePath, string[] segments, CancellationToken ct)
        {
            var (fullPath, problem) = LocalTargetPath.Resolve(target, segments);

            if (fullPath is null)
            {
                Fail(WouldBePath(segments), devicePath, problem!, otherReason: true);
                return;
            }
            var temporary = Path.Combine(Path.GetDirectoryName(fullPath)!, $".{Path.GetFileName(fullPath)}.{Guid.NewGuid():N}.partial");

            progress?.Invoke(new DownloadProgress(_saved, _failed, devicePath));

            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

                await using (var destination = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, FileBufferSize, FileOptions.Asynchronous))
                {
                    await transfers.DownloadAsync(storage.StorageType, devicePath, destination, ct);
                }
                ct.ThrowIfCancellationRequested();
                System.IO.File.Move(temporary, fullPath, overwrite: true);

                _saved++;
                Results.Add(CopyResults.Copied(fullPath, devicePath));
            }
            catch (Exception error) when (!ct.IsCancellationRequested)
            {
                Fail(fullPath, devicePath, error);
            }
            finally
            {
                DeleteQuietly(temporary);
            }
            progress?.Invoke(new DownloadProgress(_saved, _failed, devicePath));
        }

        private void Fail(string localPath, string devicePath, Exception error)
        {
            switch (error)
            {
                case TeensyApiException { StatusCode: 413 }:
                    Fail(localPath, devicePath, TooLargeMessage, otherReason: true);
                    break;
                case IOException or UnauthorizedAccessException:
                    Fail(localPath, devicePath, error.Message, otherReason: true);
                    break;
                default:
                    var mapped = ExitCodeMapper.Map(error);

                    Fail(localPath, devicePath, mapped.Message, otherReason: mapped.Code != CliExitCode.NotFound);
                    break;
            }
        }

        private void Fail(string localPath, string devicePath, string message, bool otherReason)
        {
            _failed++;
            AnyFailedForOtherReasons |= otherReason;
            Results.Add(CopyResults.Failed(localPath, devicePath, message));
        }

        /// <summary>Where a name would have gone under the target. Never <c>Path.Combine</c>: on Windows it drops everything before a rooted segment such as <c>C:evil.prg</c>.</summary>
        private string WouldBePath(string[] segments) => segments.Length == 0 ? target : Path.Join([target, .. segments]);

        private static bool SamePath(string left, string right) =>
            left.TrimEnd('/').Equals(right.TrimEnd('/'), StringComparison.OrdinalIgnoreCase);

        private static void DeleteQuietly(string file)
        {
            try
            {
                System.IO.File.Delete(file);
            }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            {
                // A leftover temp file is the lesser harm; the real name never held it.
            }
        }
    }
}
