namespace TeensyRom.Cli.Update;

/// <summary>
/// The working folder of an update, <c>&lt;root&gt;/.trom-update</c>: on the install's own volume so every move is a
/// rename. It holds the download, the unpacked package, the backups of what the swap replaced and the journal.
/// </summary>
internal static class UpdateFolder
{
    public const string Name = ".trom-update";

    public static string For(string root) => Path.Combine(root, Name);

    public static string Download(string updateFolder) => Path.Combine(updateFolder, "download");

    public static string Staging(string updateFolder) => Path.Combine(updateFolder, "staging");

    public static string Backup(string updateFolder) => Path.Combine(updateFolder, "backup");

    public static string Journal(string updateFolder) => Path.Combine(updateFolder, SwapJournal.FileName);
}

/// <summary>
/// Holds <c>update.lock</c> open without sharing, so one update at a time touches the install and nothing cleans up
/// under a running one. The file is deleted when the lock is released (on Windows also when the process dies), so an
/// update folder can be removed once it is empty.
/// </summary>
internal sealed class UpdateLock : IDisposable
{
    private const string FileName = "update.lock";

    private readonly string _updateFolder;
    private readonly FileStream _stream;
    private bool _released;

    private UpdateLock(string updateFolder, FileStream stream)
    {
        _updateFolder = updateFolder;
        _stream = stream;
    }

    /// <summary>The lock, or null when another process holds it.</summary>
    /// <exception cref="UnauthorizedAccessException">When the folder can't be written.</exception>
    public static UpdateLock? TryAcquire(string updateFolder)
    {
        for (var attempt = 0; ; attempt++)
        {
            Directory.CreateDirectory(updateFolder);

            try
            {
                // Windows deletes the file as the handle closes, even if the process dies. Elsewhere Dispose unlinks it
                // while the lock is still held, so a refused open never removes the holder's file.
                var options = OperatingSystem.IsWindows() ? FileOptions.DeleteOnClose : FileOptions.None;
                var stream = new FileStream(Path.Combine(updateFolder, FileName), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None, bufferSize: 1, options);

                return new UpdateLock(updateFolder, stream);
            }
            catch (DirectoryNotFoundException) when (attempt < 3)
            {
                // A releasing process removed the folder, empty, between the create and the open.
            }
            catch (IOException)
            {
                return null;
            }
        }
    }

    /// <summary>
    /// Deletes everything in the update folder but the lock file, releases the lock, then removes the folder if it is empty.
    /// The contents go while the lock is held, so an update that starts meanwhile is refused; the folder goes only if
    /// nobody has put anything in it since, so one that starts right after the release keeps its files. A failure is
    /// ignored: what is left is cleared by the next run.
    /// </summary>
    /// <param name="files">Deletes the contents and the folder.</param>
    public void ClearAndRelease(IFileOps files)
    {
        Ignoring(() =>
        {
            foreach (var entry in files.Entries(_updateFolder).Where(entry => !IsLockFile(entry)))
            {
                Ignoring(() => Delete(files, entry));
            }
        });

        Dispose();
        Ignoring(() => files.DeleteEmptyDirectory(_updateFolder));
    }

    /// <summary>Releases the lock and removes its file. Only the first call does anything: a later one could delete the lock file of an update that started since.</summary>
    public void Dispose()
    {
        if (_released) return;
        _released = true;

        if (!OperatingSystem.IsWindows()) Ignoring(() => File.Delete(Path.Combine(_updateFolder, FileName)));

        _stream.Dispose();
    }

    private static bool IsLockFile(string path) => string.Equals(Path.GetFileName(path), FileName, PackageSwapper.PathComparison);

    private static void Delete(IFileOps files, string entry)
    {
        if (files.DirectoryExists(entry)) files.DeleteDirectory(entry);
        else files.DeleteFile(entry);
    }

    private static void Ignoring(Action action)
    {
        try { action(); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }
}
