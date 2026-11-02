using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

/// <summary>The update lock and the clean-up that lets go of it, on a real folder.</summary>
public sealed class UpdateLockTests : IDisposable
{
    private readonly Scratch _scratch = new();

    private string Folder => _scratch.At(".trom-update");

    private string LockFile => _scratch.At(".trom-update/update.lock");

    public void Dispose() => _scratch.Dispose();

    private UpdateLock Acquire() => UpdateLock.TryAcquire(Folder) ?? throw new InvalidOperationException("the lock is held");

    private void FillFolder()
    {
        _scratch.Write(".trom-update/download/package.zip", "zip");
        _scratch.Write(".trom-update/staging/cli/trom.exe", "new trom");
        _scratch.Write(".trom-update/backup/api/old.txt", "old");
        _scratch.Write(".trom-update/journal.json", "{}");
        _scratch.Write(".trom-update/journal.json.tmp", "{");
    }

    [Fact]
    public void Releasing_DeletesTheLockFile_AndLetsTheNextUpdateIn()
    {
        var held = Acquire();
        File.Exists(LockFile).Should().BeTrue();

        held.Dispose();

        File.Exists(LockFile).Should().BeFalse();
        using var next = UpdateLock.TryAcquire(Folder);
        next.Should().NotBeNull();
    }

    [Fact]
    public void AnAcquireThatFails_LeavesTheHoldersLockFileAndLockAlone()
    {
        using var held = Acquire();

        UpdateLock.TryAcquire(Folder).Should().BeNull();

        File.Exists(LockFile).Should().BeTrue();
        UpdateLock.TryAcquire(Folder).Should().BeNull("a refused attempt must not unlink the file and let a third one in");
    }

    [Fact]
    public void ClearAndRelease_DeletesEveryEntryWhileTheLockIsHeld_ThenRemovesTheFolderAfterLettingGo()
    {
        using var held = Acquire();
        FillFolder();
        var deletes = new RecordingDeletes(new PhysicalFileOps(), Folder);

        held.ClearAndRelease(deletes);

        var contents = deletes.Deletes.Where(delete => delete.Path != Folder).ToList();
        contents.Select(delete => Path.GetFileName(delete.Path)).Should().BeEquivalentTo("download", "staging", "backup", "journal.json", "journal.json.tmp");
        contents.Should().OnlyContain(delete => delete.LockHeld);
        deletes.Deletes.Should().ContainSingle(delete => delete.Path == Folder).Which.LockHeld.Should().BeFalse();
        Directory.Exists(Folder).Should().BeFalse();
    }

    [Fact]
    public void ClearAndRelease_WhenAnotherUpdateStartsAfterTheRelease_LeavesItsFilesAndItsLock()
    {
        using var held = Acquire();
        FillFolder();
        using var files = new UpdateStartingAfterRelease(new PhysicalFileOps(), Folder);

        held.ClearAndRelease(files);

        files.Started.Should().BeTrue("the lock was free once the clean-up let go of it");
        File.ReadAllText(Path.Combine(Folder, "staging", "package.zip")).Should().Be("its download");
        UpdateLock.TryAcquire(Folder).Should().BeNull();
    }

    [Fact]
    public void ClearAndRelease_WhenAFileIsInUse_DeletesTheRest_AndLeavesTheFolderForTheNextRun()
    {
        using var held = Acquire();
        FillFolder();
        var files = new ScriptedFileOps(new PhysicalFileOps()) { FailDelete = path => path.EndsWith("journal.json", StringComparison.Ordinal) };

        var clear = () => held.ClearAndRelease(files);

        clear.Should().NotThrow();
        File.Exists(_scratch.At(".trom-update/journal.json")).Should().BeTrue();
        Directory.Exists(_scratch.At(".trom-update/download")).Should().BeFalse();
        Directory.Exists(_scratch.At(".trom-update/backup")).Should().BeFalse();
        File.Exists(LockFile).Should().BeFalse();
    }

    /// <summary>Stands in for a trom update that starts the moment the lock is released: it takes the lock and stages a file before the folder is removed.</summary>
    private sealed class UpdateStartingAfterRelease(IFileOps inner, string folder) : DecoratedFileOps(inner), IDisposable
    {
        private UpdateLock? _other;

        public bool Started => _other is not null;

        public override void DeleteEmptyDirectory(string path)
        {
            _other = UpdateLock.TryAcquire(folder);
            Directory.CreateDirectory(Path.Combine(folder, "staging"));
            File.WriteAllText(Path.Combine(folder, "staging", "package.zip"), "its download");

            base.DeleteEmptyDirectory(path);
        }

        public void Dispose() => _other?.Dispose();
    }
}
