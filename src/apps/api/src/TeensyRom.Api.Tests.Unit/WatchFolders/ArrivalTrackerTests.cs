using TeensyRom.Api.Transfers.Archives;
using TeensyRom.Api.WatchFolders;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Tests.Unit.WatchFolders;

/// <summary>
/// The arrival rules, driven with explicit times against a fake file system: what counts as new, when it has settled,
/// and how settled files group into sets. Settle 2 s, grouping window 3 s, set hold 20 s; time advances in 0.5 s ticks.
/// </summary>
public class ArrivalTrackerTests
{
    private static readonly TimeSpan Step = TimeSpan.FromMilliseconds(500);
    private static readonly string[] ArchiveExtensions = [".zip", ".7z", ".rar"];

    private readonly string _root = Path.Combine(Path.GetTempPath(), "tr-watch-root");
    private readonly FakeWatchedFileSystem _fs = new();
    private readonly IArchiveReader _archives = Substitute.For<IArchiveReader>();
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly WatchFolderOptions _options = new()
    {
        SettleTime = TimeSpan.FromSeconds(2),
        PollInterval = Step,
        GroupingWindow = TimeSpan.FromSeconds(3),
        MaxSetHold = TimeSpan.FromSeconds(20)
    };
    private readonly ArrivalTracker _tracker;
    private DateTimeOffset _now = new(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);

    public ArrivalTrackerTests()
    {
        _fs.AddDirectory(_root);
        _archives.IsArchiveExtension(Arg.Any<string>())
            .Returns(call => ArchiveExtensions.Contains(Path.GetExtension(call.Arg<string>()), StringComparer.OrdinalIgnoreCase));
        _tracker = new ArrivalTracker("folder-1", _root, _options, _fs, _archives, _log);
    }

    private string P(string relative) => Path.Combine(_root, relative.Replace('/', Path.DirectorySeparatorChar));

    private void Created(string relative) => _tracker.OnEvent(new FolderEvent(FolderEventKind.Created, P(relative)), _now);

    private void Changed(string relative) => _tracker.OnEvent(new FolderEvent(FolderEventKind.Changed, P(relative)), _now);

    private void Renamed(string relative, string oldRelative) =>
        _tracker.OnEvent(new FolderEvent(FolderEventKind.Renamed, P(relative), P(oldRelative)), _now);

    private List<ArrivalSet> Run(double seconds)
    {
        var sets = new List<ArrivalSet>();
        var until = _now + TimeSpan.FromSeconds(seconds);

        while (_now < until)
        {
            _now += Step;
            sets.AddRange(_tracker.Tick(_now));
        }

        return sets;
    }

    private static string[] Paths(ArrivalSet set) => [.. set.Files.Select(f => f.RelativePath).Order(StringComparer.Ordinal)];

    [Fact]
    public void NewFile_ArrivesOnceItHasSettled_AndTheSetClosesAfterTheGroupingWindow()
    {
        _fs.AddFile(P("game.sid"), 100);
        Created("game.sid");

        Run(4).Should().BeEmpty("the file settles after 2 s and the set closes 3 s after that");
        var set = Run(3).Should().ContainSingle().Subject;

        set.WatchFolderId.Should().Be("folder-1");
        var file = set.Files.Should().ContainSingle().Subject;
        file.RelativePath.Should().Be("game.sid");
        file.FullPath.Should().Be(P("game.sid"));
        file.SizeBytes.Should().Be(100);
        file.IsArchive.Should().BeFalse();
    }

    [Fact]
    public void GrowingFile_RestartsTheSettleClock()
    {
        _fs.AddFile(P("big.d64"), 100);
        Created("big.d64");
        Run(1.5);

        _fs.SetSize(P("big.d64"), 200);
        Run(2).Should().BeEmpty();
        _fs.SetSize(P("big.d64"), 300);
        Run(2).Should().BeEmpty("it grew again, so it had not been unchanged for 2 s yet");

        var set = Run(8).Should().ContainSingle().Subject;
        set.Files.Single().SizeBytes.Should().Be(300);
    }

    [Fact]
    public void LockedFile_WaitsUntilItIsReadable()
    {
        _fs.AddFile(P("copy.prg"), 100, readable: false);
        Created("copy.prg");

        Run(15).Should().BeEmpty();

        _fs.SetReadable(P("copy.prg"), true);
        Run(6).Should().ContainSingle().Which.Files.Should().ContainSingle();
    }

    [Fact]
    public void FileThatVanishes_NeverArrives()
    {
        _fs.AddFile(P("temp.sid"), 100);
        Created("temp.sid");
        Run(1);

        _fs.Remove(P("temp.sid"));

        Run(15).Should().BeEmpty();
    }

    [Fact]
    public void Link_IsDropped()
    {
        _fs.AddFile(P("link.sid"), 100, isLink: true);
        Created("link.sid");

        Run(15).Should().BeEmpty();
    }

    [Fact]
    public void PartialDownload_RenamedToItsFinalName_ArrivesOnce()
    {
        _fs.AddFile(P("notes.txt.crdownload"), 50);
        Created("notes.txt.crdownload");
        Run(1);

        _fs.Remove(P("notes.txt.crdownload"));
        _fs.AddFile(P("notes.txt"), 80);
        Renamed("notes.txt", "notes.txt.crdownload");

        var sets = Run(10);

        sets.Should().ContainSingle().Which.Files.Should().ContainSingle().Which.RelativePath.Should().Be("notes.txt");
    }

    [Fact]
    public void RenamingAnExistingFile_IsNotAnArrival()
    {
        _fs.AddFile(P("game2.prg"), 100);

        Renamed("game2.prg", "game.prg");

        Run(15).Should().BeEmpty();
    }

    [Fact]
    public void RenamingADirectory_SendsNothing()
    {
        _fs.AddFile(P("renamed/a.sid"), 100);
        _fs.AddFile(P("renamed/b.sid"), 100);

        Renamed("renamed", "original");

        Run(15).Should().BeEmpty();
    }

    [Fact]
    public void ChangedOnADirectory_IsIgnored_SoAFileAddedToAnExistingSubfolderSendsOnlyThatFile()
    {
        _fs.AddFile(P("pack/old1.sid"), 100);
        _fs.AddFile(P("pack/old2.sid"), 100);

        _fs.AddFile(P("pack/new.sid"), 100);
        Changed("pack");
        Created("pack/new.sid");

        var set = Run(10).Should().ContainSingle().Subject;
        Paths(set).Should().Equal("pack/new.sid");
    }

    [Fact]
    public void CopiedDirectory_IsExpandedIntoItsFiles_WithTheRelativeLayoutKept_AndNoFileTwice()
    {
        _fs.AddFile(P("album/one.sid"), 100);
        _fs.AddFile(P("album/disc/two.sid"), 200);
        _fs.AddFile(P("album/disc/three.prg"), 300);
        Created("album");
        Created("album/one.sid");

        var set = Run(10).Should().ContainSingle().Subject;

        Paths(set).Should().Equal("album/disc/three.prg", "album/disc/two.sid", "album/one.sid");
    }

    [Fact]
    public void DownloadDirectory_IsNeverExpanded()
    {
        _fs.AddFile(P("game.prg.download/game.prg"), 100);
        Created("game.prg.download");
        Created("game.prg.download/game.prg");

        Run(15).Should().BeEmpty();
    }

    [Fact]
    public void DownloadDirectoryInsideACopiedTree_IsSkipped()
    {
        _fs.AddFile(P("tree/keep.sid"), 100);
        _fs.AddFile(P("tree/inner.prg.download/inner.prg"), 100);
        Created("tree");

        var set = Run(10).Should().ContainSingle().Subject;

        Paths(set).Should().Equal("tree/keep.sid");
    }

    [Fact]
    public void SafariPackage_GrowingInsideItDoesNotHoldASetOpen_AndTheFinishedFileMovedOutArrives()
    {
        _fs.AddFile(P("quick.sid"), 100);
        Created("quick.sid");
        _fs.AddFile(P("game.prg.download/game.prg"), 10);

        var sets = new List<ArrivalSet>();
        for (var i = 0; i < 14; i++)
        {
            _fs.SetSize(P("game.prg.download/game.prg"), 10 + i);
            Changed("game.prg.download/game.prg");
            sets.AddRange(Run(0.5));
        }

        sets.Should().ContainSingle().Which.Files.Should().ContainSingle().Which.RelativePath.Should().Be("quick.sid");

        _fs.Remove(P("game.prg.download"));
        _fs.AddFile(P("game.prg"), 24);
        Renamed("game.prg", "game.prg.download/game.prg");

        Run(10).Should().ContainSingle().Which.Files.Should().ContainSingle().Which.RelativePath.Should().Be("game.prg");
    }

    [Fact]
    public void ZeroByteFile_NeverSettlesUntilItGrows_AndNeverHoldsASetOpen()
    {
        _fs.AddFile(P("placeholder.sid"), 0);
        _fs.AddFile(P("other.sid"), 100);
        Created("placeholder.sid");
        Created("other.sid");

        var first = Run(10).Should().ContainSingle().Subject;
        Paths(first).Should().Equal("other.sid");

        _fs.SetSize(P("placeholder.sid"), 40);
        var second = Run(10).Should().ContainSingle().Subject;
        second.Files.Should().ContainSingle().Which.SizeBytes.Should().Be(40);
    }

    [Fact]
    public void ChangedRightAfterDispatch_IsIgnored_ButAFreshCopyOverTheFileLaterIsAnArrival()
    {
        _fs.AddFile(P("tune.sid"), 100);
        Created("tune.sid");
        Run(10).Should().ContainSingle();

        Changed("tune.sid");
        Run(10).Should().BeEmpty("the touch fell within the window after it was sent");

        Changed("tune.sid");
        Run(10).Should().ContainSingle().Which.Files.Should().ContainSingle().Which.RelativePath.Should().Be("tune.sid");
    }

    [Fact]
    public void ChangedOnAFileThatWasNotJustSent_IsACopyOverAndArrives()
    {
        _fs.AddFile(P("existing.sid"), 100);

        Changed("existing.sid");

        Run(10).Should().ContainSingle();
    }

    [Fact]
    public void RepeatCreated_AfterDispatch_SendsAgain_AndWhilePendingDoesNotDuplicate()
    {
        _fs.AddFile(P("tune.sid"), 100);
        Created("tune.sid");
        Created("tune.sid");
        Run(10).Should().ContainSingle().Which.Files.Should().ContainSingle();

        Created("tune.sid");
        Run(10).Should().ContainSingle().Which.Files.Should().ContainSingle();
    }

    [Fact]
    public void FileWrittenAgainBeforeItsSetCloses_IsSentOnceWithItsFinalSize()
    {
        _fs.AddFile(P("tune.sid"), 100);
        Created("tune.sid");
        Run(3);

        _fs.SetSize(P("tune.sid"), 500);
        Changed("tune.sid");

        var set = Run(10).Should().ContainSingle().Subject;
        set.Files.Should().ContainSingle().Which.SizeBytes.Should().Be(500);
    }

    [Fact]
    public void FilesSettlingCloseTogether_JoinOneSet_AndALaterFileFormsTheNext()
    {
        _fs.AddFile(P("a.sid"), 100);
        Created("a.sid");
        Run(2);
        _fs.AddFile(P("b.sid"), 100);
        Created("b.sid");

        var first = Run(10).Should().ContainSingle().Subject;
        Paths(first).Should().Equal("a.sid", "b.sid");

        _fs.AddFile(P("c.sid"), 100);
        Created("c.sid");
        var second = Run(10).Should().ContainSingle().Subject;
        Paths(second).Should().Equal("c.sid");
    }

    [Fact]
    public void SetStaysOpen_WhileANonEmptyFileIsStillBeingWritten_AndTheTailJoinsIt()
    {
        _fs.AddFile(P("quick.sid"), 100);
        Created("quick.sid");
        _fs.AddFile(P("slow.d64"), 10);
        Created("slow.d64");

        var sets = new List<ArrivalSet>();
        for (var i = 0; i < 20; i++)
        {
            _fs.SetSize(P("slow.d64"), 10 + i);
            sets.AddRange(Run(0.5));
        }

        sets.Should().BeEmpty("the slow copy is still growing");

        var set = Run(10).Should().ContainSingle().Subject;
        Paths(set).Should().Equal("quick.sid", "slow.d64");
    }

    [Fact]
    public void SetHold_IsBounded_ThenTheStillWrittenFileFormsALaterSet()
    {
        _fs.AddFile(P("quick.sid"), 100);
        Created("quick.sid");
        _fs.AddFile(P("endless.d64"), 10);
        Created("endless.d64");

        var sets = new List<ArrivalSet>();
        for (var i = 0; i < 50; i++)
        {
            _fs.SetSize(P("endless.d64"), 10 + i);
            sets.AddRange(Run(0.5));
        }

        var first = sets.Should().ContainSingle("the hold ends after the 20 s maximum").Subject;
        Paths(first).Should().Equal("quick.sid");

        var later = Run(10).Should().ContainSingle().Subject;
        Paths(later).Should().Equal("endless.d64");
    }

    [Fact]
    public void FileOfAnUnsupportedType_IsDroppedSilently()
    {
        _fs.AddFile(P("report.doc"), 100);
        Created("report.doc");

        Run(15).Should().BeEmpty();
        _log.ReceivedCalls().Should().BeEmpty();
    }

    [Fact]
    public void Archive_WithATransferableOrNestedArchiveEntry_IsKept()
    {
        _fs.AddFile(P("pack.zip"), 100);
        _fs.AddFile(P("nested.7z"), 100);
        _archives.ReadIndex(P("pack.zip")).Returns(Index(("music/", true), ("music/tune.sid", false)));
        _archives.ReadIndex(P("nested.7z")).Returns(Index(("inner.zip", false)));
        Created("pack.zip");
        Created("nested.7z");

        var set = Run(10).Should().ContainSingle().Subject;

        set.Files.Should().OnlyContain(f => f.IsArchive);
        Paths(set).Should().Equal("nested.7z", "pack.zip");
    }

    [Fact]
    public void Archive_WithNothingTransferable_IsDroppedSilently()
    {
        _fs.AddFile(P("docs.zip"), 100);
        _archives.ReadIndex(P("docs.zip")).Returns(Index(("readme.doc", false), ("folder.sid/", true)));
        Created("docs.zip");

        Run(15).Should().BeEmpty();
        _log.DidNotReceiveWithAnyArgs().InternalWarning(default!, default);
    }

    [Fact]
    public void UnreadableArchive_IsDroppedWithOneWarningNamingIt()
    {
        _fs.AddFile(P("broken.zip"), 100);
        _archives.ReadIndex(P("broken.zip")).Returns(_ => throw new ArchiveReadException("truncated"));
        Created("broken.zip");

        Run(15).Should().BeEmpty();
        _log.Received(1).InternalWarning(Arg.Is<string>(m => m.Contains("broken.zip")), Arg.Any<string?>());
    }

    private static ArchiveIndex Index(params (string Path, bool IsDirectory)[] entries) =>
        new([.. entries.Select(e => new ArchiveEntryInfo(e.Path, 10, e.IsDirectory, IsSymlink: false))], 10);
}
