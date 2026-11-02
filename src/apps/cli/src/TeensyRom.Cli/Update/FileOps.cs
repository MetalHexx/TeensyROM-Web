namespace TeensyRom.Cli.Update;

/// <summary>
/// The file system as the update sees it, so the swap and its rollback can be driven against a failing disk.
/// Folders and files are told apart by what is on disk; every path is absolute.
/// </summary>
internal interface IFileOps
{
    bool FileExists(string path);

    bool DirectoryExists(string path);

    /// <summary>The files and folders directly inside <paramref name="folder"/>; empty when it doesn't exist.</summary>
    IReadOnlyList<string> Entries(string folder);

    void CreateDirectory(string path);

    /// <summary>Renames a file or a folder; the destination must not exist.</summary>
    void Move(string source, string destination);

    /// <summary>
    /// Writes <paramref name="content"/> to <paramref name="path"/>, replacing what is there in one rename, so a crash leaves
    /// the old file or the new one whole. The bytes are on disk when it returns.
    /// </summary>
    void WriteFile(string path, byte[] content);

    /// <summary>Deletes a file; a missing file is fine.</summary>
    void DeleteFile(string path);

    /// <summary>Deletes a folder and everything in it; a missing folder is fine.</summary>
    void DeleteDirectory(string path);

    /// <summary>Deletes a folder that has nothing in it; a missing folder is fine. Anything in it makes it fail with an <see cref="IOException"/>.</summary>
    void DeleteEmptyDirectory(string path);

    /// <summary>The bytes free on the volume holding <paramref name="path"/>, or the nearest folder above it that exists; null when that can't be told.</summary>
    long? FreeSpace(string path);

    /// <summary>Lets the owner, group and others run the file. Does nothing on Windows.</summary>
    void MakeExecutable(string path);

    string CurrentDirectory { get; set; }
}

/// <summary>The real file system.</summary>
internal sealed class PhysicalFileOps : IFileOps
{
    public bool FileExists(string path) => File.Exists(path);

    public bool DirectoryExists(string path) => Directory.Exists(path);

    public IReadOnlyList<string> Entries(string folder) =>
        Directory.Exists(folder) ? Directory.GetFileSystemEntries(folder) : [];

    public void CreateDirectory(string path) => Directory.CreateDirectory(path);

    public void Move(string source, string destination)
    {
        if (Directory.Exists(source)) Directory.Move(source, destination);
        else File.Move(source, destination);
    }

    public void WriteFile(string path, byte[] content)
    {
        var temp = $"{path}.tmp";

        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        using (var stream = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            stream.Write(content);
            stream.Flush(flushToDisk: true);
        }
        File.Move(temp, path, overwrite: true);
    }

    public void DeleteFile(string path) => File.Delete(path);

    public void DeleteDirectory(string path)
    {
        if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
    }

    public void DeleteEmptyDirectory(string path)
    {
        if (Directory.Exists(path)) Directory.Delete(path, recursive: false);
    }

    public long? FreeSpace(string path)
    {
        try
        {
            var full = Path.GetFullPath(path);

            // On Unix the path root is always "/", whatever volume the path is on; DriveInfo asks the file system about the path it is given.
            return new DriveInfo(OperatingSystem.IsWindows() ? Path.GetPathRoot(full)! : NearestExisting(full)).AvailableFreeSpace;
        }
        catch (Exception ex) when (ex is IOException or ArgumentException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    private static string NearestExisting(string path)
    {
        while (!Directory.Exists(path) && Path.GetDirectoryName(path) is { } parent) path = parent;

        return path;
    }

    public void MakeExecutable(string path)
    {
        if (OperatingSystem.IsWindows()) return;

        File.SetUnixFileMode(path, File.GetUnixFileMode(path) | UnixFileMode.UserExecute | UnixFileMode.GroupExecute | UnixFileMode.OtherExecute);
    }

    public string CurrentDirectory
    {
        get => Directory.GetCurrentDirectory();
        set => Directory.SetCurrentDirectory(value);
    }
}

/// <summary>
/// Retries what changes the disk when something else briefly holds the files: Defender scanning a new executable, the
/// search indexer, an Explorer window. A file that isn't there is not retried, because waiting won't bring it.
/// </summary>
/// <param name="backoff">The waits between attempts; one more attempt follows each. Defaults to about 15 seconds in all.</param>
/// <param name="sleep">Waits for the given time; tests replace it so they don't.</param>
internal sealed class RetryingFileOps(IFileOps inner, IReadOnlyList<TimeSpan>? backoff = null, Action<TimeSpan>? sleep = null) : IFileOps
{
    internal static readonly IReadOnlyList<TimeSpan> DefaultBackoff =
    [
        TimeSpan.FromMilliseconds(100), TimeSpan.FromMilliseconds(200), TimeSpan.FromMilliseconds(400), TimeSpan.FromMilliseconds(800),
        TimeSpan.FromMilliseconds(1600), TimeSpan.FromMilliseconds(3200), TimeSpan.FromSeconds(4), TimeSpan.FromSeconds(4)
    ];

    private readonly IReadOnlyList<TimeSpan> _backoff = backoff ?? DefaultBackoff;
    private readonly Action<TimeSpan> _sleep = sleep ?? Thread.Sleep;

    public bool FileExists(string path) => inner.FileExists(path);

    public bool DirectoryExists(string path) => inner.DirectoryExists(path);

    public IReadOnlyList<string> Entries(string folder) => inner.Entries(folder);

    public long? FreeSpace(string path) => inner.FreeSpace(path);

    public void MakeExecutable(string path) => inner.MakeExecutable(path);

    // Not retried: a folder that isn't empty belongs to another update, and waiting won't change that.
    public void DeleteEmptyDirectory(string path) => inner.DeleteEmptyDirectory(path);

    public string CurrentDirectory
    {
        get => inner.CurrentDirectory;
        set => inner.CurrentDirectory = value;
    }

    public void CreateDirectory(string path) => Retry(() => inner.CreateDirectory(path));

    public void Move(string source, string destination) => Retry(() => inner.Move(source, destination));

    public void WriteFile(string path, byte[] content) => Retry(() => inner.WriteFile(path, content));

    public void DeleteFile(string path) => Retry(() => inner.DeleteFile(path));

    public void DeleteDirectory(string path) => Retry(() => inner.DeleteDirectory(path));

    private void Retry(Action action)
    {
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                action();
                return;
            }
            catch (Exception ex) when (IsTransient(ex) && attempt < _backoff.Count)
            {
                _sleep(_backoff[attempt]);
            }
        }
    }

    private static bool IsTransient(Exception ex) =>
        ex is UnauthorizedAccessException || ex is IOException and not (FileNotFoundException or DirectoryNotFoundException);
}
