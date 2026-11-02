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
/// under a running one.
/// </summary>
internal sealed class UpdateLock : IDisposable
{
    private readonly FileStream _stream;

    private UpdateLock(FileStream stream) => _stream = stream;

    /// <summary>The lock, or null when another process holds it.</summary>
    /// <exception cref="UnauthorizedAccessException">When the folder can't be written.</exception>
    public static UpdateLock? TryAcquire(string updateFolder)
    {
        Directory.CreateDirectory(updateFolder);

        try
        {
            return new UpdateLock(new FileStream(Path.Combine(updateFolder, "update.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None));
        }
        catch (IOException)
        {
            return null;
        }
    }

    public void Dispose() => _stream.Dispose();
}
