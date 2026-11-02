using System.Text.Json;

namespace TeensyRom.Cli.Update;

/// <summary>Replaces the installed package with the unpacked one, and undoes a swap that didn't finish.</summary>
internal interface IPackageSwapper
{
    /// <summary>
    /// Swaps the package unpacked in the update folder's <c>staging</c> in for <c>api/</c>, <c>README.txt</c> and the
    /// contents of <paramref name="cliFolder"/>, keeping what it replaced in <c>backup</c>. A failure puts everything back.
    /// </summary>
    /// <param name="root">The release root, which holds <c>api/</c> and the CLI folder.</param>
    /// <param name="runningExecutable">The running trom, which is renamed aside rather than moved out; null when it isn't in <paramref name="cliFolder"/>.</param>
    /// <exception cref="SwapFailedException">When a step failed; <see cref="SwapFailedException.RolledBack"/> says whether the old install is back.</exception>
    void Swap(string root, string cliFolder, string? runningExecutable);

    /// <summary>Undoes a swap that began and never committed. Returns false when there was nothing to undo.</summary>
    /// <exception cref="SwapFailedException">When it couldn't be undone, or the journal can't be read.</exception>
    bool Recover(string updateFolder, string root);
}

/// <summary>A swap that failed. <see cref="RolledBack"/> is false when even the undo failed, which leaves the update folder to recover from.</summary>
internal sealed class SwapFailedException(string message, bool rolledBack, Exception? inner = null) : Exception(message, inner)
{
    public bool RolledBack { get; } = rolledBack;
}

/// <summary>
/// Every move of the swap is written to a journal first, so a swap that is interrupted, or fails, can be undone by
/// moving each recorded destination back in reverse. Undoing looks at the disk rather than trusting the journal: a
/// move that was recorded but never happened is skipped.
/// </summary>
internal sealed class PackageSwapper(IFileOps files) : IPackageSwapper
{
    public void Swap(string root, string cliFolder, string? runningExecutable)
    {
        var updateFolder = UpdateFolder.For(root);
        var staging = UpdateFolder.Staging(updateFolder);
        var backup = UpdateFolder.Backup(updateFolder);
        var journalPath = UpdateFolder.Journal(updateFolder);
        var journal = new SwapJournal();

        void Move(string from, string to)
        {
            journal.Moves.Add(new JournalMove(Relative(root, from), Relative(root, to)));
            journal.Save(journalPath);
            files.CreateDirectory(Path.GetDirectoryName(to)!);
            files.Move(from, to);
        }

        try
        {
            journal.Save(journalPath);

            Replace(Path.Combine(root, "api"),Path.Combine(staging, "api"), Path.Combine(backup, "api"), Move);
            Replace(Path.Combine(root, "README.txt"), Path.Combine(staging, "README.txt"), Path.Combine(backup, "README.txt"), Move);

            foreach (var entry in files.Entries(cliFolder))
            {
                if (entry.EndsWith(".old", StringComparison.OrdinalIgnoreCase)) continue;

                if (IsSamePath(entry, runningExecutable)) Move(entry, FreeOldName(entry));
                else Move(entry, Path.Combine(backup, "cli", Path.GetFileName(entry)));
            }

            foreach (var entry in files.Entries(Path.Combine(staging, "cli")))
            {
                Move(entry, Path.Combine(cliFolder, Path.GetFileName(entry)));
            }

            journal.Committed = true;
            journal.Save(journalPath);
        }
        catch (Exception ex)
        {
            throw RollBack(root, journal, ex);
        }
    }

    public bool Recover(string updateFolder, string root)
    {
        var journal = SwapJournal.Load(UpdateFolder.Journal(updateFolder));

        if (journal is null || journal.Committed) return false;

        try
        {
            Undo(root, journal);
        }
        catch (Exception ex)
        {
            throw new SwapFailedException(
                $"A previous update didn't finish and couldn't be undone ({ex.Message.TrimEnd('.')}). The files it replaced are in {UpdateFolder.Backup(updateFolder)}.",
                rolledBack: false, ex);
        }

        files.DeleteFile(UpdateFolder.Journal(updateFolder));
        return true;
    }

    private void Replace(string installed, string staged, string backedUp, Action<string, string> move)
    {
        if (files.FileExists(installed) || files.DirectoryExists(installed)) move(installed, backedUp);

        move(staged, installed);
    }

    private SwapFailedException RollBack(string root, SwapJournal journal, Exception failure)
    {
        var reason = failure.Message.TrimEnd('.');

        try
        {
            Undo(root, journal);
        }
        catch (Exception undoFailure)
        {
            return new SwapFailedException(
                $"The update failed ({reason}) and the previous version couldn't be fully restored ({undoFailure.Message.TrimEnd('.')}). Run trom again to finish restoring it.",
                rolledBack: false, failure);
        }

        return new SwapFailedException(
            $"The update failed ({reason}); the previous version is back in place. Close anything using TeensyROM Suite's files and try again.",
            rolledBack: true, failure);
    }

    private void Undo(string root, SwapJournal journal)
    {
        for (var i = journal.Moves.Count - 1; i >= 0; i--)
        {
            var from = Resolve(root, journal.Moves[i].From);
            var to = Resolve(root, journal.Moves[i].To);

            if (!Exists(to)) continue;

            if (Exists(from)) throw new IOException($"{from} and {to} both exist");

            files.CreateDirectory(Path.GetDirectoryName(from)!);
            files.Move(to, from);
        }
    }

    private bool Exists(string path) => files.FileExists(path) || files.DirectoryExists(path);

    private string FreeOldName(string executable)
    {
        var name = $"{executable}.old";

        for (var n = 1; Exists(name); n++) name = $"{executable}.{n}.old";

        return name;
    }

    private static bool IsSamePath(string path, string? other) =>
        other is not null && string.Equals(Path.GetFullPath(path), Path.GetFullPath(other), PathComparison);

    internal static StringComparison PathComparison =>
        OperatingSystem.IsWindows() || OperatingSystem.IsMacOS() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    private static string Relative(string root, string path) => Path.GetRelativePath(root, path).Replace('\\', '/');

    private static string Resolve(string root, string relative) => Path.Combine(root, relative);
}

/// <summary>The moves a swap has made or is about to make, as paths relative to the release root.</summary>
internal sealed class SwapJournal
{
    public const string FileName = "journal.json";

    public bool Committed { get; set; }

    public List<JournalMove> Moves { get; set; } = [];

    /// <summary>The journal at <paramref name="path"/>; null when there is none.</summary>
    /// <exception cref="SwapFailedException">When the file is there and can't be read.</exception>
    public static SwapJournal? Load(string path)
    {
        if (!File.Exists(path)) return null;

        try
        {
            return JsonSerializer.Deserialize<SwapJournal>(File.ReadAllText(path), JsonSerializerOptions.Web)
                ?? throw new JsonException("the journal is empty");
        }
        catch (Exception ex) when (ex is JsonException or IOException or UnauthorizedAccessException)
        {
            throw new SwapFailedException(
                $"A previous update left a journal that can't be read ({ex.Message.TrimEnd('.')}). Its files are in {Path.GetDirectoryName(path)}.",
                rolledBack: false, ex);
        }
    }

    /// <summary>Writes the journal to disk before returning, replacing the last one in a single rename so a crash leaves one whole file.</summary>
    public void Save(string path)
    {
        var temp = $"{path}.tmp";

        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        using (var stream = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            JsonSerializer.Serialize(stream, this, JsonSerializerOptions.Web);
            stream.Flush(flushToDisk: true);
        }
        File.Move(temp, path, overwrite: true);
    }
}

/// <summary>One rename of the swap: <see cref="From"/> became <see cref="To"/>, both relative to the release root with <c>/</c> separators.</summary>
internal sealed record JournalMove(string From, string To);
