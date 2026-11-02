using System.Text.Json;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

/// <summary>An installed release and an unpacked newer one beside it, both on disk.</summary>
internal sealed class SwapSandbox : IDisposable
{
    public Scratch Scratch { get; } = new();

    public string Root => Scratch.At("install");

    public string CliFolder => Scratch.At("install/cli");

    public string RunningExecutable => Scratch.At("install/cli/trom.exe");

    public string UpdateFolder => Scratch.At("install/.trom-update");

    public string Staging => Scratch.At("install/.trom-update/staging");

    public string Journal => Scratch.At("install/.trom-update/journal.json");

    public SwapSandbox()
    {
        Scratch.Write("install/api/TeensyRom.Api.exe", "old api");
        Scratch.Write("install/api/appsettings.json", "old settings");
        Scratch.Write("install/api/wwwroot/index.html", "old html");
        Scratch.Write("install/api/Assets/old-only.txt", "old asset");
        Scratch.Write("install/README.txt", "old readme");
        Scratch.Write("install/cli/trom.exe", "old trom");
        Scratch.Write("install/cli/notes.txt", "old notes");

        Scratch.Write("install/.trom-update/staging/README.txt", "new readme");
        Scratch.Write("install/.trom-update/staging/api/TeensyRom.Api.exe", "new api");
        Scratch.Write("install/.trom-update/staging/api/appsettings.json", "new settings");
        Scratch.Write("install/.trom-update/staging/api/wwwroot/index.html", "new html");
        Scratch.Write("install/.trom-update/staging/cli/trom.exe", "new trom");
    }

    public SortedDictionary<string, string> Installed() => TreeSnapshot.Of(Root, ".trom-update");

    public SortedDictionary<string, string> Staged() => TreeSnapshot.Of(Staging);

    public void Swap(IFileOps files) => new PackageSwapper(files).Swap(Root, CliFolder, RunningExecutable);

    public string Read(string relative) => File.ReadAllText(Scratch.At(relative));

    public void Dispose() => Scratch.Dispose();
}

public sealed class PackageSwapTests : IDisposable
{
    private readonly SwapSandbox _sandbox = new();

    public void Dispose() => _sandbox.Dispose();

    [Fact]
    public void Swap_PutsTheNewPackageInPlaceAndKeepsWhatItReplaced()
    {
        _sandbox.Swap(new PhysicalFileOps());

        _sandbox.Read("install/api/TeensyRom.Api.exe").Should().Be("new api");
        _sandbox.Read("install/api/wwwroot/index.html").Should().Be("new html");
        File.Exists(_sandbox.Scratch.At("install/api/Assets/old-only.txt")).Should().BeFalse();
        _sandbox.Read("install/README.txt").Should().Be("new readme");
        _sandbox.Read("install/cli/trom.exe").Should().Be("new trom");
        File.Exists(_sandbox.Scratch.At("install/cli/notes.txt")).Should().BeFalse();

        _sandbox.Read("install/.trom-update/backup/api/Assets/old-only.txt").Should().Be("old asset");
        _sandbox.Read("install/.trom-update/backup/README.txt").Should().Be("old readme");
        _sandbox.Read("install/.trom-update/backup/cli/notes.txt").Should().Be("old notes");
    }

    [Fact]
    public void Swap_RenamesTheRunningExecutableAsideInsteadOfMovingItOut()
    {
        _sandbox.Swap(new PhysicalFileOps());

        _sandbox.Read("install/cli/trom.exe.old").Should().Be("old trom");
        File.Exists(_sandbox.Scratch.At("install/.trom-update/backup/cli/trom.exe")).Should().BeFalse();
    }

    [Fact]
    public void Swap_WhenTheOldNameIsTaken_NumbersTheRenameAndLeavesTheEarlierOneAlone()
    {
        _sandbox.Scratch.Write("install/cli/trom.exe.old", "older trom");

        _sandbox.Swap(new PhysicalFileOps());

        _sandbox.Read("install/cli/trom.exe.old").Should().Be("older trom");
        _sandbox.Read("install/cli/trom.exe.1.old").Should().Be("old trom");
        File.Exists(_sandbox.Scratch.At("install/.trom-update/backup/cli/trom.exe.old")).Should().BeFalse();
    }

    [Fact]
    public void Swap_WhenNothingIsInstalledYet_JustMovesTheNewPackageIn()
    {
        Directory.Delete(_sandbox.Scratch.At("install/api"), recursive: true);
        File.Delete(_sandbox.Scratch.At("install/README.txt"));

        _sandbox.Swap(new PhysicalFileOps());

        _sandbox.Read("install/api/TeensyRom.Api.exe").Should().Be("new api");
        _sandbox.Read("install/README.txt").Should().Be("new readme");
    }

    [Fact]
    public void Swap_RecordsEveryMoveInAJournalThatEndsCommitted()
    {
        var counter = new FailingMoves(new PhysicalFileOps());

        _sandbox.Swap(counter);

        var journal = JsonSerializer.Deserialize<SwapJournal>(File.ReadAllText(_sandbox.Journal), JsonSerializerOptions.Web)!;
        journal.Committed.Should().BeTrue();
        journal.Moves.Should().HaveCount(counter.Moves);
        journal.Moves.Should().OnlyContain(move => !Path.IsPathRooted(move.From) && !Path.IsPathRooted(move.To));
        File.Exists(_sandbox.Journal + ".tmp").Should().BeFalse();
    }

    // ---- failure and rollback ------------------------------------------------------------------------------

    [Fact]
    public void Swap_WhenAnyMoveFails_PutsEverythingBackSoTheTreeIsIdentical()
    {
        var clean = new FailingMoves(new PhysicalFileOps());
        using (var probe = new SwapSandbox()) probe.Swap(clean);
        clean.Moves.Should().BeGreaterThan(4);

        for (var failing = 1; failing <= clean.Moves; failing++)
        {
            using var sandbox = new SwapSandbox();
            var installed = sandbox.Installed();
            var staged = sandbox.Staged();

            var swap = () => sandbox.Swap(new FailingMoves(new PhysicalFileOps(), failing));

            var error = swap.Should().Throw<SwapFailedException>($"move {failing} fails").Which;
            error.RolledBack.Should().BeTrue($"move {failing} fails");
            error.Message.Should().Contain("simulated failure on move").And.Contain("previous version is back");
            sandbox.Installed().Should().Equal(installed, $"move {failing} fails");
            sandbox.Staged().Should().Equal(staged, $"move {failing} fails");
        }
    }

    [Fact]
    public void Swap_WhenTheJournalCantBeWritten_FailsWithoutHavingMovedAnything()
    {
        Directory.CreateDirectory(_sandbox.Journal + ".tmp");
        var installed = _sandbox.Installed();

        var swap = () => _sandbox.Swap(new PhysicalFileOps());

        swap.Should().Throw<SwapFailedException>().Which.RolledBack.Should().BeTrue();
        _sandbox.Installed().Should().Equal(installed);
    }

    [Fact]
    public void Swap_WhenTheDiskGoesAwayForTheUndoToo_SaysSoAndRecoverRestoresTheTreeLater()
    {
        var installed = _sandbox.Installed();
        var staged = _sandbox.Staged();

        var swap = () => _sandbox.Swap(new FailingMoves(new PhysicalFileOps(), failFrom: 5, persistent: true));

        var error = swap.Should().Throw<SwapFailedException>().Which;
        error.RolledBack.Should().BeFalse();
        error.Message.Should().Contain("couldn't be fully restored").And.Contain("Run trom again");
        _sandbox.Installed().Should().NotEqual(installed);

        new PackageSwapper(new PhysicalFileOps()).Recover(_sandbox.UpdateFolder, _sandbox.Root).Should().BeTrue();

        _sandbox.Installed().Should().Equal(installed);
        _sandbox.Staged().Should().Equal(staged);
        File.Exists(_sandbox.Journal).Should().BeFalse();
    }

    // ---- recovery ------------------------------------------------------------------------------------------

    [Fact]
    public void Recover_WithNoJournalOrACommittedOne_DoesNothing()
    {
        var swapper = new PackageSwapper(new PhysicalFileOps());

        swapper.Recover(_sandbox.UpdateFolder, _sandbox.Root).Should().BeFalse();

        _sandbox.Swap(new PhysicalFileOps());
        var swapped = _sandbox.Installed();

        swapper.Recover(_sandbox.UpdateFolder, _sandbox.Root).Should().BeFalse();
        _sandbox.Installed().Should().Equal(swapped);
    }

    [Fact]
    public void Recover_SkipsAMoveThatWasRecordedButNeverHappened()
    {
        var installed = _sandbox.Installed();
        new SwapJournal { Moves = [new JournalMove("api", ".trom-update/backup/api")] }.Save(_sandbox.Journal);

        new PackageSwapper(new PhysicalFileOps()).Recover(_sandbox.UpdateFolder, _sandbox.Root).Should().BeTrue();

        _sandbox.Installed().Should().Equal(installed);
    }

    [Fact]
    public void Recover_WhenTheJournalCantBeRead_RefusesAndTouchesNothing()
    {
        File.WriteAllText(_sandbox.Journal, "{ not json");
        var installed = _sandbox.Installed();

        var recover = () => new PackageSwapper(new PhysicalFileOps()).Recover(_sandbox.UpdateFolder, _sandbox.Root);

        recover.Should().Throw<SwapFailedException>().Which.RolledBack.Should().BeFalse();
        _sandbox.Installed().Should().Equal(installed);
        File.Exists(_sandbox.Journal).Should().BeTrue();
    }

    [Fact]
    public void Recover_WhenAMoveCantBeUndone_KeepsTheJournalAndSaysWhereTheBackupIs()
    {
        var swap = () => _sandbox.Swap(new FailingMoves(new PhysicalFileOps(), failFrom: 5, persistent: true));
        swap.Should().Throw<SwapFailedException>();

        var recover = () => new PackageSwapper(new FailingMoves(new PhysicalFileOps(), failFrom: 1, persistent: true)).Recover(_sandbox.UpdateFolder, _sandbox.Root);

        recover.Should().Throw<SwapFailedException>().Which.Message.Should().Contain("couldn't be undone").And.Contain("backup");
        File.Exists(_sandbox.Journal).Should().BeTrue();
    }

    // ---- Windows file locks --------------------------------------------------------------------------------

    [Theory]
    [InlineData("install/README.txt")]
    [InlineData("install/api/appsettings.json")]
    [InlineData("install/cli/notes.txt")]
    public void Swap_WhenAFileIsHeldOpenOnWindows_RetriesThenRollsBackToAnIdenticalTree(string held)
    {
        if (!OperatingSystem.IsWindows()) return;

        var installed = _sandbox.Installed();
        var staged = _sandbox.Staged();
        var sleeps = new List<TimeSpan>();
        var files = new RetryingFileOps(new PhysicalFileOps(), [TimeSpan.FromMilliseconds(1), TimeSpan.FromMilliseconds(2)], sleeps.Add);

        using var hold = new FileStream(_sandbox.Scratch.At(held), FileMode.Open, FileAccess.Read, FileShare.None);

        var swap = () => _sandbox.Swap(files);

        swap.Should().Throw<SwapFailedException>().Which.RolledBack.Should().BeTrue();
        sleeps.Should().Equal(TimeSpan.FromMilliseconds(1), TimeSpan.FromMilliseconds(2));

        hold.Dispose();
        _sandbox.Installed().Should().Equal(installed);
        _sandbox.Staged().Should().Equal(staged);
    }
}
