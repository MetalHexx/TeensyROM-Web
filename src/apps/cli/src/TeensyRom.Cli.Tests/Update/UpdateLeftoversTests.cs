using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

/// <summary>The tidy-up at the start of a run, on a real install folder.</summary>
public sealed class UpdateLeftoversTests : IDisposable
{
    private readonly SwapSandbox _sandbox = new();
    private readonly ScriptedFileOps _files = new(new PhysicalFileOps());

    public void Dispose() => _sandbox.Dispose();

    private UpdateLeftovers Leftovers(InstallKind kind = InstallKind.Release) =>
        new(new StubInspector(new InstallInfo(kind, _sandbox.CliFolder, kind == InstallKind.Release ? _sandbox.Root : null, null)),
            new PackageSwapper(_files), _files);

    private bool Exists(string relative) => File.Exists(_sandbox.Scratch.At(relative)) || Directory.Exists(_sandbox.Scratch.At(relative));

    [Fact]
    public void AfterAnUpdate_DeletesTheWorkFolderAndTheOldExecutable()
    {
        _sandbox.Swap(_files);
        _sandbox.Scratch.Write("install/.trom-update/download/package.zip", "zip");

        Leftovers().CleanQuietly();

        Exists("install/.trom-update").Should().BeFalse();
        Exists("install/cli/trom.exe.old").Should().BeFalse();
        _sandbox.Read("install/cli/trom.exe").Should().Be("new trom");
        _sandbox.Read("install/api/TeensyRom.Api.exe").Should().Be("new api");
    }

    [Fact]
    public void AnOldExecutableStillInUse_IsLeftForTheNextRun()
    {
        _sandbox.Swap(_files);
        _files.FailDelete = path => path.EndsWith("trom.exe.old", StringComparison.Ordinal);

        var clean = () => Leftovers().CleanQuietly();

        clean.Should().NotThrow();
        Exists("install/cli/trom.exe.old").Should().BeTrue();
        Exists("install/.trom-update").Should().BeFalse();

        _files.FailDelete = _ => false;
        Leftovers().CleanQuietly();
        Exists("install/cli/trom.exe.old").Should().BeFalse();
    }

    [Fact]
    public void AnUpdateThatDiedHalfWay_IsUndoneBeforeAnythingIsDeleted()
    {
        var installed = _sandbox.Installed();
        var swap = () => _sandbox.Swap(new FailingMoves(new PhysicalFileOps(), failFrom: 5, persistent: true));
        swap.Should().Throw<SwapFailedException>();
        _sandbox.Installed().Should().NotEqual(installed);

        Leftovers().CleanQuietly();

        _sandbox.Installed().Should().Equal(installed);
        Exists("install/.trom-update").Should().BeFalse();
    }

    [Fact]
    public void AnUpdateThatCantBeUndone_KeepsEveryBackupAndTheOldExecutable()
    {
        var swap = () => _sandbox.Swap(new FailingMoves(new PhysicalFileOps(), failFrom: 7, persistent: true));
        swap.Should().Throw<SwapFailedException>();
        File.WriteAllText(_sandbox.Journal, "{ not json");

        var clean = () => Leftovers().CleanQuietly();

        clean.Should().NotThrow();
        Exists("install/.trom-update/backup/api").Should().BeTrue();
        Exists("install/cli/trom.exe.old").Should().BeTrue();
    }

    [Fact]
    public void WhileAnotherProcessIsUpdating_NothingIsTouched()
    {
        _sandbox.Swap(_files);
        using var updating = UpdateLock.TryAcquire(_sandbox.UpdateFolder);

        Leftovers().CleanQuietly();

        Exists("install/.trom-update/backup/api").Should().BeTrue();
        Exists("install/cli/trom.exe.old").Should().BeTrue();
    }

    [Theory]
    [InlineData(nameof(InstallKind.Source))]
    [InlineData(nameof(InstallKind.Unknown))]
    [InlineData(nameof(InstallKind.Homebrew))]
    public void ForAnythingButAReleaseInstall_DoesNothing(string kindName)
    {
        _sandbox.Swap(_files);

        Leftovers(Enum.Parse<InstallKind>(kindName)).CleanQuietly();

        Exists("install/.trom-update/backup/api").Should().BeTrue();
        Exists("install/cli/trom.exe.old").Should().BeTrue();
    }

    [Fact]
    public void WithNothingToTidy_DoesNotCreateTheWorkFolder()
    {
        Directory.Delete(_sandbox.UpdateFolder, recursive: true);

        Leftovers().CleanQuietly();

        Exists("install/.trom-update").Should().BeFalse();
    }

    [Fact]
    public void NeverThrows_WhateverGoesWrong()
    {
        var leftovers = new UpdateLeftovers(new ThrowingInspector(), new PackageSwapper(_files), _files);

        var clean = () => leftovers.CleanQuietly();

        clean.Should().NotThrow();
    }

    private sealed class ThrowingInspector : IInstallInspector
    {
        public InstallInfo Inspect() => throw new InvalidOperationException("boom");
    }
}
