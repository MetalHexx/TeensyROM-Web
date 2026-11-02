namespace TeensyRom.Cli.Update;

/// <summary>
/// Tidies up after an update, at the start of a run: puts the old install back when an update died half-way, and
/// deletes the backups, the unpacked package and the <c>.old</c> executable the update renamed aside.
/// </summary>
/// <param name="files">Should not retry: this runs before the command the user typed and must never hold it up.</param>
/// <param name="warn">Receives the one line said when an interrupted update can't be undone; stderr in the real CLI.</param>
internal sealed class UpdateLeftovers(IInstallInspector inspector, IPackageSwapper swapper, IFileOps files, Action<string>? warn = null)
{
    /// <summary>
    /// Does the tidying for a release install and nothing for any other. Never throws and never waits: what is still
    /// in use, such as the old executable of an update that is only now ending, is left for the next run. The one thing
    /// it says is that an interrupted update couldn't be undone, because that leaves the install broken.
    /// Everything is done while holding the update lock, the <c>.old</c> executables too: a running update needs the one
    /// it renamed aside to roll back.
    /// </summary>
    public void CleanQuietly()
    {
        try
        {
            var install = inspector.Inspect();

            if (install.Kind != InstallKind.Release || install.Root is not { } root) return;

            var updateFolder = UpdateFolder.For(root);

            if (!files.DirectoryExists(updateFolder) && OldExecutables(install.CliFolder).Count == 0) return;

            using var held = UpdateLock.TryAcquire(updateFolder);

            if (held is null) return;

            // When the previous version can't be put back, the backups and the .old files stay.
            try
            {
                swapper.Recover(updateFolder, root);
            }
            catch (SwapFailedException)
            {
                warn?.Invoke($"An earlier update didn't finish and couldn't be undone. The files it replaced are in {UpdateFolder.Backup(updateFolder)}; move them back into {root} by hand.");
                return;
            }

            foreach (var old in OldExecutables(install.CliFolder))
            {
                TryDelete(() => files.DeleteFile(old));
            }

            held.ClearAndRelease(files);
        }
        catch (Exception)
        {
            // Housekeeping must never change the outcome of the command being run; whatever is left is tried again next time.
        }
    }

    private List<string> OldExecutables(string cliFolder) =>
        files.Entries(cliFolder).Where(entry => entry.EndsWith(".old", StringComparison.OrdinalIgnoreCase) && files.FileExists(entry)).ToList();

    private static void TryDelete(Action delete)
    {
        try { delete(); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }
}
