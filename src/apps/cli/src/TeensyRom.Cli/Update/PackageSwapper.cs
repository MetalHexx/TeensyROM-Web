using System.Text.Json;

namespace TeensyRom.Cli.Update;

/// <summary>Replaces the installed package with the unpacked one, and undoes a swap that didn't finish.</summary>
internal interface IPackageSwapper
{
    /// <summary>
    /// Swaps the package unpacked in the update folder's <c>staging</c> in for <c>api/</c>, <c>README.txt</c> and the
    /// contents of <paramref name="cliFolder"/>, keeping what it replaced in <c>backup</c>. A failure puts everything back,
    /// except one writing the journal's final mark after every move was made: that swap is whole and stays.
    /// </summary>
    /// <param name="root">The release root, which holds <c>api/</c> and the CLI folder.</param>
    /// <param name="runningExecutable">The running trom, which is renamed aside rather than moved out; null when it isn't in <paramref name="cliFolder"/>.</param>
    /// <exception cref="SwapFailedException">When a step failed; <see cref="SwapFailedException.RolledBack"/> says whether the old install is back.</exception>
    void Swap(string root, string cliFolder, string? runningExecutable);

    /// <summary>Undoes a swap that began and never committed. Returns false when there was nothing to undo, which includes a swap that was already undone.</summary>
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
/// move that was recorded but never happened, or that an earlier undo already reversed, is skipped.
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

        // All the moves are recorded before the first is made, so nothing but the moves lies between them.
        void MoveAll(params (string From, string To)[] moves)
        {
            foreach (var (from, to) in moves) journal.Moves.Add(new JournalMove(Relative(root, from), Relative(root, to)));

            journal.Save(files, journalPath);

            foreach (var (from, to) in moves)
            {
                files.CreateDirectory(Path.GetDirectoryName(to)!);
                files.Move(from, to);
            }
        }

        void Move(string from, string to) => MoveAll((from, to));

        try
        {
            journal.Save(files, journalPath);

            Replace(Path.Combine(root, "api"), Path.Combine(staging, "api"), Path.Combine(backup, "api"), Move);
            Replace(Path.Combine(root, "README.txt"), Path.Combine(staging, "README.txt"), Path.Combine(backup, "README.txt"), Move);

            SwapCli(cliFolder, Path.Combine(staging, "cli"), Path.Combine(backup, "cli"), runningExecutable, Move, MoveAll);
        }
        catch (Exception ex)
        {
            throw RollBack(root, journal, journalPath, ex);
        }

        Commit(journal, journalPath);
    }

    public bool Recover(string updateFolder, string root)
    {
        var journalPath = UpdateFolder.Journal(updateFolder);
        var journal = SwapJournal.Load(journalPath);

        if (journal is null || journal.Committed || journal.RolledBack) return false;

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

        MarkRolledBack(journal, journalPath);
        TryDeleteJournal(journalPath);
        return true;
    }

    private void Replace(string installed, string staged, string backedUp, Action<string, string> move)
    {
        if (files.FileExists(installed) || files.DirectoryExists(installed)) move(installed, backedUp);

        move(staged, installed);
    }

    // On Windows the running trom can't be moved out, only renamed, and until the new one is in there is no trom at all:
    // the other entries go first, and the rename and the move of the new trom are made back to back.
    private void SwapCli(
        string cliFolder, string stagedCli, string backedUpCli, string? runningExecutable,
        Action<string, string> move, Action<(string From, string To)[]> moveAll)
    {
        var installed = files.Entries(cliFolder).Where(entry => !entry.EndsWith(".old", StringComparison.OrdinalIgnoreCase)).ToList();
        var staged = files.Entries(stagedCli);
        var running = installed.FirstOrDefault(entry => IsSamePath(entry, runningExecutable));

        foreach (var entry in installed.Where(entry => entry != running))
        {
            move(entry, Path.Combine(backedUpCli, Path.GetFileName(entry)));
        }

        var replacement = running is null
            ? null
            : staged.FirstOrDefault(entry => IsSamePath(Path.Combine(cliFolder, Path.GetFileName(entry)), running));

        if (running is not null && replacement is not null)
        {
            moveAll([(running, FreeOldName(running)), (replacement, running)]);
        }
        else if (running is not null)
        {
            move(running, FreeOldName(running));
        }

        foreach (var entry in staged.Where(entry => entry != replacement))
        {
            move(entry, Path.Combine(cliFolder, Path.GetFileName(entry)));
        }
    }

    // Every move has been made, so a journal that can't be marked committed must not undo a swap that is whole: it is
    // deleted instead, which is the same as committed. If even that fails the journal stays uncommitted, and the next
    // run's recovery reverts the update: a whole old install, not a broken one.
    private void Commit(SwapJournal journal, string journalPath)
    {
        journal.Committed = true;

        try
        {
            journal.Save(files, journalPath);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            TryDeleteJournal(journalPath);
        }
    }

    private SwapFailedException RollBack(string root, SwapJournal journal, string journalPath, Exception failure)
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

        MarkRolledBack(journal, journalPath);

        return new SwapFailedException(
            $"The update failed ({reason}); the previous version is back in place. Close anything using TeensyROM Suite's files and try again.",
            rolledBack: true, failure);
    }

    // The journal outlives the update folder's cleanup when a delete fails; marked, a later Recover leaves the tree alone.
    private void MarkRolledBack(SwapJournal journal, string journalPath)
    {
        journal.RolledBack = true;

        try
        {
            journal.Save(files, journalPath);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // Undo recognises moves it has already reversed, so an unmarked journal is still safe to run again.
        }
    }

    private void TryDeleteJournal(string journalPath)
    {
        try
        {
            files.DeleteFile(journalPath);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // The update folder's cleanup retries it.
        }
    }

    private void Undo(string root, SwapJournal journal)
    {
        for (var i = journal.Moves.Count - 1; i >= 0; i--)
        {
            var from = Resolve(root, journal.Moves[i].From);
            var to = Resolve(root, journal.Moves[i].To);

            if (!Exists(to) || OriginalIsBack(root, journal, i)) continue;

            if (Exists(from)) throw new IOException($"{from} and {to} both exist");

            files.CreateDirectory(Path.GetDirectoryName(from)!);
            files.Move(to, from);
        }
    }

    // A move into a path that an earlier move emptied has been undone when that earlier move has been too: the path holds
    // the original again, and moving it out would lose it.
    private bool OriginalIsBack(string root, SwapJournal journal, int index) =>
        journal.Moves.Take(index).Any(earlier => earlier.From == journal.Moves[index].To && !Exists(Resolve(root, earlier.To)));

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

    /// <summary>The moves were all undone; there is nothing left for <see cref="IPackageSwapper.Recover"/> to do.</summary>
    public bool RolledBack { get; set; }

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

    /// <summary>Writes the journal to disk before returning, through <paramref name="files"/> so a file another process briefly holds is retried like a move.</summary>
    public void Save(IFileOps files, string path) =>
        files.WriteFile(path, JsonSerializer.SerializeToUtf8Bytes(this, JsonSerializerOptions.Web));
}

/// <summary>One rename of the swap: <see cref="From"/> became <see cref="To"/>, both relative to the release root with <c>/</c> separators.</summary>
internal sealed record JournalMove(string From, string To);
