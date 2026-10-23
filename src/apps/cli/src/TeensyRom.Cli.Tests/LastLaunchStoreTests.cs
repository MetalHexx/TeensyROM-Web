using NSubstitute;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Logging;
using TeensyRom.Cli.Player;
using TeensyRom.Cli.Settings;
using TeensyRom.Cli.Storage.Entities;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// <see cref="LastLaunchStore"/> over the test home's <c>last-launch.json</c>. Every test starts without the file.
/// </summary>
public sealed class LastLaunchStoreTests : IDisposable
{
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly LastLaunchStore _sut;

    public LastLaunchStoreTests()
    {
        _sut = new LastLaunchStore(_log);
        Clean();
    }

    public void Dispose() => Clean();

    private static string RecordPath => TeensyRomHome.LastLaunchPath;

    private static void Clean()
    {
        var folder = Path.GetDirectoryName(RecordPath)!;

        if (!Directory.Exists(folder)) return;

        foreach (var file in Directory.EnumerateFiles(folder, "last-launch.json*")) File.Delete(file);
        foreach (var directory in Directory.EnumerateDirectories(folder, "last-launch.json*")) Directory.Delete(directory, recursive: true);
    }

    private static string[] LeftOvers() => Directory.EnumerateFiles(Path.GetDirectoryName(RecordPath)!, "*.tmp").ToArray();

    private static LaunchedFile Pick(int number) => new($"/music/{number}.sid", 1000 + number);

    private static LastLaunchRecord Record(string id = "dev-1", string name = "Bench") => new(
        id,
        name,
        TeensyStorageType.USB,
        new LaunchedFile("/music/Commando.sid", 4096),
        PlayMode.Search,
        "commando",
        TeensyFilterType.Music,
        StorageScope.DirShallow,
        "/music",
        PlayState.Paused,
        [Pick(1), Pick(2), Pick(3)],
        1);

    [Fact]
    public void Load_WithoutTheFile_IsNull()
    {
        _sut.Load("dev-1").Should().BeNull();
        _sut.Find("Bench").Should().BeNull();
    }

    [Theory]
    [InlineData("this is not json")]
    [InlineData("{ \"version\": 2, \"devices\": { \"dev-1\": { \"deviceId\": \"dev-1\" } } }")]
    [InlineData("{ \"version\": 1 }")]
    [InlineData("")]
    public void Load_OfAnUnreadableFileOrAnotherVersion_IsNull_AndTheNextSaveReplacesIt(string content)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(RecordPath)!);
        File.WriteAllText(RecordPath, content);

        _sut.Load("dev-1").Should().BeNull();

        _sut.Save(Record());

        _sut.Load("dev-1").Should().BeEquivalentTo(Record());
        LeftOvers().Should().BeEmpty();
    }

    [Fact]
    public void Save_ThenLoad_RoundTripsEveryField()
    {
        var record = Record() with { SearchQuery = null, Current = null };

        _sut.Save(Record());
        _sut.Load("dev-1").Should().BeEquivalentTo(Record());

        _sut.Save(record);
        _sut.Load("dev-1").Should().BeEquivalentTo(record);
    }

    [Fact]
    public void Save_KeepsDevicesApart()
    {
        _sut.Save(Record("dev-1", "Bench"));
        _sut.Save(Record("dev-2", "Rack") with { PlayState = PlayState.Playing, Mode = PlayMode.Random });
        _sut.Save(Record("dev-1", "Bench") with { PlayState = PlayState.Stopped });

        _sut.Load("dev-1")!.PlayState.Should().Be(PlayState.Stopped);
        _sut.Load("dev-2").Should().BeEquivalentTo(Record("dev-2", "Rack") with { PlayState = PlayState.Playing, Mode = PlayMode.Random });
    }

    [Fact]
    public void Save_LeavesNoTempFileBehind()
    {
        _sut.Save(Record());
        _sut.Save(Record() with { PlayState = PlayState.Playing });

        LeftOvers().Should().BeEmpty();
        Directory.EnumerateFiles(Path.GetDirectoryName(RecordPath)!, "last-launch.json*").Should().Equal(RecordPath);
    }

    [Fact]
    public void Save_KeepsOnlyTheNewestHundredPicks()
    {
        var picks = Enumerable.Range(0, 130).Select(Pick).ToList();

        _sut.Save(Record() with { RandomPicks = picks, RandomIndex = 129 });

        var loaded = _sut.Load("dev-1")!;
        loaded.RandomPicks.Should().Equal(picks.Skip(30));
        loaded.RandomIndex.Should().Be(99);
    }

    [Fact]
    public void Save_WhenTrimming_KeepsTheIndexOnTheSamePick()
    {
        var picks = Enumerable.Range(0, 130).Select(Pick).ToList();

        _sut.Save(Record() with { RandomPicks = picks, RandomIndex = 110 });

        var loaded = _sut.Load("dev-1")!;
        loaded.RandomPicks[loaded.RandomIndex].Should().Be(picks[110]);
    }

    [Fact]
    public void Save_WhenTrimmingDropsThePickTheIndexWasOn_ClampsTheIndexToMinusOne()
    {
        var picks = Enumerable.Range(0, 130).Select(Pick).ToList();

        _sut.Save(Record() with { RandomPicks = picks, RandomIndex = 5 });

        _sut.Load("dev-1")!.RandomIndex.Should().Be(-1);
    }

    [Fact]
    public void Load_WhileAnotherReaderHasTheFileOpen_StillReads()
    {
        _sut.Save(Record());

        using var reader = new FileStream(RecordPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);

        _sut.Load("dev-1").Should().BeEquivalentTo(Record());
    }

    [Fact]
    public void Save_WhileAReaderHasTheFileOpenForAMoment_RetriesUntilItCanReplaceIt()
    {
        _sut.Save(Record());
        var reader = new FileStream(RecordPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        var release = new Thread(() =>
        {
            Thread.Sleep(10);
            reader.Dispose();
        });
        release.Start();

        _sut.Save(Record() with { PlayState = PlayState.Stopped });

        release.Join();
        _log.DidNotReceiveWithAnyArgs().InternalError(default!);
        _sut.Load("dev-1")!.PlayState.Should().Be(PlayState.Stopped);
        LeftOvers().Should().BeEmpty();
    }

    [Fact]
    public void Save_WhenTheFileCantBeReplaced_LogsIt_ThrowsNothing_AndLeavesNoTempFile()
    {
        Directory.CreateDirectory(RecordPath);

        var save = () => _sut.Save(Record());

        save.Should().NotThrow();
        _log.ReceivedWithAnyArgs(1).InternalError(default!);
        LeftOvers().Should().BeEmpty();
    }

    [Fact]
    public void Find_MatchesAnIdExactly_AndANameInAnyCase()
    {
        _sut.Save(Record("dev-1", "Bench"));
        _sut.Save(Record("dev-2", "Rack"));

        _sut.Find("dev-2")!.DeviceName.Should().Be("Rack");
        _sut.Find("BENCH")!.DeviceId.Should().Be("dev-1");
        _sut.Find("rack")!.DeviceId.Should().Be("dev-2");
        _sut.Find("Shelf").Should().BeNull();
    }

    [Fact]
    public void Find_OfANameTwoDevicesShare_IsAUsageError()
    {
        _sut.Save(Record("dev-1", "Bench"));
        _sut.Save(Record("dev-2", "bench"));

        var find = () => _sut.Find("BENCH");

        find.Should().Throw<CliException>().Which.Code.Should().Be(CliExitCode.Usage);
        _sut.Find("dev-2")!.DeviceId.Should().Be("dev-2", "an id still finds its device");
    }

    [Fact]
    public void MarkStopped_StopsTheRecordedDevice_AndOnlyThat()
    {
        _sut.Save(Record("dev-1", "Bench") with { PlayState = PlayState.Playing });
        _sut.Save(Record("dev-2", "Rack") with { PlayState = PlayState.Playing });

        _sut.MarkStopped("dev-1");

        _sut.Load("dev-1")!.PlayState.Should().Be(PlayState.Stopped);
        _sut.Load("dev-2")!.PlayState.Should().Be(PlayState.Playing);
    }

    [Fact]
    public void MarkStopped_WithoutARecord_DoesNothing()
    {
        _sut.MarkStopped("dev-1");
        File.Exists(RecordPath).Should().BeFalse();

        _sut.Save(Record("dev-2", "Rack"));
        _sut.MarkStopped("dev-1");

        _sut.Load("dev-1").Should().BeNull();
        _sut.Load("dev-2").Should().BeEquivalentTo(Record("dev-2", "Rack"));
    }
}
