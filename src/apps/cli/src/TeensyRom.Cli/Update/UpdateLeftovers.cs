namespace TeensyRom.Cli.Update;

/// <summary>
/// Tidies up after an update, at the start of a run: puts the old install back when an update died half-way, and
/// deletes the backups, the unpacked package and the <c>.old</c> executable the update renamed aside.
/// </summary>
/// <param name="files">Should not retry: this runs before the command the user typed and must never hold it up.</param>
internal sealed class UpdateLeftovers(IInstallInspector inspector, IPackageSwapper swapper, IFileOps files)
{
    /// <summary>
    /// Does the tidying for a release install and nothing for any other. Never throws and never waits: what is still
    /// in use, such as the old executable of an update that is only now ending, is left for the next run.
    /// </summary>
    public void CleanQuietly()
    {
        try
        {
            var install = inspector.Inspect();

            if (install.Kind != InstallKind.Release || install.Root is not { } root) return;

            var updateFolder = UpdateFolder.For(root);

            if (files.DirectoryExists(updateFolder) && !CleanUpdateFolder(updateFolder, root)) return;

            DeleteOldExecutables(install.CliFolder);
        }
        catch (Exception)
        {
            // Housekeeping must never change the outcome of the command being run; whatever is left is tried again next time.
        }
    }

    /// <summary>False when an update is running: its files, and the <c>.old</c> executable it made, aren't ours to touch.</summary>
    private bool CleanUpdateFolder(string updateFolder, string root)
    {
        using var held = UpdateLock.TryAcquire(updateFolder);

        if (held is null) return false;

        // When the previous version can't be put back this throws, and the backups and the .old file stay.
        swapper.Recover(updateFolder, root);

        TryDelete(() => files.DeleteDirectory(UpdateFolder.Backup(updateFolder)));
        TryDelete(() => files.DeleteDirectory(UpdateFolder.Staging(updateFolder)));
        TryDelete(() => files.DeleteDirectory(UpdateFolder.Download(updateFolder)));
        TryDelete(() => files.DeleteFile(UpdateFolder.Journal(updateFolder)));

        held.Dispose();
        TryDelete(() => files.DeleteDirectory(updateFolder));

        return true;
    }

    private void DeleteOldExecutables(string cliFolder)
    {
        foreach (var old in files.Entries(cliFolder).Where(entry => entry.EndsWith(".old", StringComparison.OrdinalIgnoreCase) && files.FileExists(entry)))
        {
            TryDelete(() => files.DeleteFile(old));
        }
    }

    private static void TryDelete(Action delete)
    {
        try { delete(); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }
}
