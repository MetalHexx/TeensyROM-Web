using System.Reflection;
using System.Text.Json;
using TeensyRom.Core.Common;
using TeensyRom.Core.Dj;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Tests.Dj;

[CollectionDefinition(Name)]
public class DjLibraryFolderCollection
{
    public const string Name = "DJ library folder";
}

/// <summary>
/// Behavioral tests for DjLibraryService against the dj/ folder under the test home.
/// </summary>
[Collection(DjLibraryFolderCollection.Name)]
public class DjLibraryServiceTests : IDisposable
{
    private const string SetId = "6f1c2b0e-8d1a-4c7e-9a43-2a1b7c9d0e11";
    private const string OtherSetId = "0b6e3c1a-5f2d-4e8b-b7a9-1c2d3e4f5a6b";
    private const string SidHash = "0123456789abcdef0123456789abcdef";

    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly string _root = Path.Combine(Assembly.GetExecutingAssembly().GetDataPath(), DjLibraryPaths.RootFolder);

    public DjLibraryServiceTests()
    {
        DeleteRoot();
    }

    public void Dispose()
    {
        DeleteRoot();
    }

    private void DeleteRoot()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    private DjLibraryService NewService(int maxSets = DjLibraryService.DefaultMaxSets) => new(_log, maxSets);

    private string SetFile(string id) => Path.Combine(_root, DjLibraryPaths.SetsFolder, id + ".json");

    private string TuneFile(string hash) => Path.Combine(_root, DjLibraryPaths.TunesFolder, hash + ".json");

    private static JsonElement Opaque(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static DjSubtuneMemory Subtune() => new()
    {
        Subtune = 1,
        Settings = Opaque("""{ "v": 1 }"""),
        Markers =
        [
            new DjLoopMarker
            {
                Id = "c1",
                Name = "Drum break",
                Start = new DjLoopBoundary { Frame = 7950, OffsetFrames = 0 },
                End = new DjLoopBoundary { Frame = 8360, OffsetFrames = 6 },
                Voices = [0, 1, 2],
                Settings = Opaque("""{ "v": 1 }"""),
                UsesOwnSettings = true,
                Wraps = true
            }
        ]
    };

    private static DjSet Set(string id = SetId, string name = "Friday warm-up", int rows = 1) => new()
    {
        Id = id,
        Name = name,
        Placeholder = "Set 3",
        Created = "2026-10-26T20:15:03.120Z",
        Updated = "2026-10-26T21:02:44.871Z",
        Rows = Enumerable.Range(0, rows).Select(i => new DjSetRow
        {
            Id = new Guid(i + 1, 0, 0, new byte[8]).ToString("D"),
            Tune = new DjRowTune { SidHash = i.ToString("x32"), Title = "Commando", Author = "Rob Hubbard", Released = "1985 Elite", SubtuneCount = 3, ByteLength = 6234 },
            CopiedFrom = new DjMemoryLink { SidHash = i.ToString("x32"), Updated = "2026-10-25T18:00:00.000Z" },
            LastSubtune = 1,
            Subtunes = [Subtune()],
            Host = Opaque("""{ "v": 1 }""")
        }).ToList()
    };

    private static DjTuneMemory Memory(string hash = SidHash) => new()
    {
        SidHash = hash,
        LastSubtune = 2,
        Subtunes = [Subtune()],
        Updated = "2026-10-26T21:02:44.871Z"
    };

    private static void AssertSameJson<T>(T actual, T expected)
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        JsonSerializer.Serialize(actual, options).Should().Be(JsonSerializer.Serialize(expected, options));
    }

    [Fact]
    public void SaveSet_ThenGet_RoundTripsOpaqueValuesToo()
    {
        var service = NewService();

        service.SaveSet(Set()).Should().Be(DjSaveResult.Saved);

        var read = NewService().GetSet(SetId);

        AssertSameJson(read, Set());
        read!.Rows[0].Host.Should().NotBeNull();
        read.Rows[0].Subtunes[0].Markers[0].Settings.Should().NotBeNull();
    }

    [Fact]
    public void TuneMemory_RoundTrips()
    {
        var service = NewService();

        service.SaveTuneMemory(Memory()).Should().BeTrue();

        AssertSameJson(NewService().GetTuneMemory(SidHash), Memory());
    }

    [Fact]
    public void LibraryState_RoundTrips_AndDefaultsToNoCurrentSet()
    {
        var service = NewService();
        service.GetLibraryState().CurrentSetId.Should().BeNull();

        service.SaveLibraryState(new DjLibraryState { CurrentSetId = SetId }).Should().BeTrue();

        NewService().GetLibraryState().CurrentSetId.Should().Be(SetId);
    }

    [Fact]
    public void MissingDocuments_ReadAsNull_WithoutWarning()
    {
        var service = NewService();

        service.GetSet(SetId).Should().BeNull();
        service.GetTuneMemory(SidHash).Should().BeNull();
        service.ListSets().Should().BeEmpty();
        _log.DidNotReceive().InternalWarning(Arg.Any<string>(), Arg.Any<string?>());
    }

    [Fact]
    public void ListSets_ShowsSummaries_AfterSaveAndAfterDelete()
    {
        var service = NewService();
        service.ListSets().Should().BeEmpty();

        service.SaveSet(Set(SetId, "Beta", rows: 2));
        service.SaveSet(Set(OtherSetId, "Alpha", rows: 0));

        service.ListSets().Select(s => (s.Id, s.Name, s.RowCount))
            .Should().Equal((OtherSetId, "Alpha", 0), (SetId, "Beta", 2));

        service.DeleteSet(SetId).Should().BeTrue();

        File.Exists(SetFile(SetId)).Should().BeFalse();
        service.ListSets().Select(s => s.Id).Should().Equal(OtherSetId);
        NewService().ListSets().Select(s => s.Id).Should().Equal(OtherSetId);
    }

    [Fact]
    public void ListSets_UpdatesSummary_WhenSetIsResaved()
    {
        var service = NewService();
        service.SaveSet(Set(rows: 1));
        service.ListSets();

        service.SaveSet(Set(name: "Renamed", rows: 3));

        service.ListSets().Should().ContainSingle().Which.Should().Match<DjSetSummary>(s => s.Name == "Renamed" && s.RowCount == 3);
    }

    [Fact]
    public void DeleteSet_OfAbsentSet_Succeeds()
    {
        NewService().DeleteSet(SetId).Should().BeTrue();
    }

    [Fact]
    public void CorruptSet_IsSkippedByList_ReadsNull_AndStaysOnDisk()
    {
        var service = NewService();
        service.SaveSet(Set(OtherSetId, "Good"));
        File.WriteAllText(SetFile(SetId), "{ not json");

        var listed = NewService().ListSets();

        listed.Select(s => s.Id).Should().Equal(OtherSetId);
        _log.Received(1).InternalWarning(Arg.Is<string>(m => m.Contains(SetId)), Arg.Any<string?>());

        _log.ClearReceivedCalls();
        service.GetSet(SetId).Should().BeNull();
        _log.Received(1).InternalWarning(Arg.Is<string>(m => m.Contains(SetId)), Arg.Any<string?>());
        File.ReadAllText(SetFile(SetId)).Should().Be("{ not json");
    }

    [Fact]
    public void IdInsideFile_NotMatchingItsName_IsCorrupt()
    {
        var service = NewService();
        service.SaveSet(Set(OtherSetId));
        File.Copy(SetFile(OtherSetId), SetFile(SetId));
        service.SaveTuneMemory(Memory());
        File.Copy(TuneFile(SidHash), TuneFile(new string('a', 32)));

        service.GetSet(SetId).Should().BeNull();
        service.GetTuneMemory(new string('a', 32)).Should().BeNull();
        NewService().ListSets().Select(s => s.Id).Should().Equal(OtherSetId);
        File.Exists(SetFile(SetId)).Should().BeTrue();
        _log.Received().InternalWarning(Arg.Any<string>(), Arg.Any<string?>());
    }

    [Fact]
    public void CorruptLibraryState_ReadsAsNoCurrentSet()
    {
        Directory.CreateDirectory(_root);
        File.WriteAllText(Path.Combine(_root, DjLibraryPaths.LibraryFile), """{ "currentSetId": "../../evil" }""");

        NewService().GetLibraryState().CurrentSetId.Should().BeNull();
        _log.Received(1).InternalWarning(Arg.Any<string>(), Arg.Any<string?>());
    }

    [Fact]
    public void SaveSet_WhenFileCannotBeReplaced_FailsAndKeepsOldFileAndLeavesNoTempFile()
    {
        var service = NewService();
        service.SaveSet(Set(OtherSetId));
        Directory.CreateDirectory(SetFile(SetId));

        service.SaveSet(Set(SetId)).Should().Be(DjSaveResult.Failed);

        Directory.Exists(SetFile(SetId)).Should().BeTrue();
        Directory.GetFiles(Path.GetDirectoryName(SetFile(SetId))!, "*.tmp").Should().BeEmpty();
        _log.Received(1).InternalError(Arg.Any<string>(), Arg.Any<string?>());
    }

    [Fact]
    public void SaveTuneMemory_WhenFileCannotBeReplaced_FailsWithoutTempFile()
    {
        var service = NewService();
        Directory.CreateDirectory(TuneFile(SidHash));

        service.SaveTuneMemory(Memory()).Should().BeFalse();

        Directory.GetFiles(Path.GetDirectoryName(TuneFile(SidHash))!, "*.tmp").Should().BeEmpty();
    }

    [Fact]
    public void DeleteSet_WhenFileCannotBeRemoved_ReturnsFalse()
    {
        var service = NewService();
        Directory.CreateDirectory(SetFile(SetId));
        File.WriteAllText(Path.Combine(SetFile(SetId), "keep.txt"), "x");

        service.DeleteSet(SetId).Should().BeFalse();
    }

    [Fact]
    public void SaveSet_OfNewIdAtLimit_ReturnsLimitReached_ButExistingIdStillSaves()
    {
        var service = NewService(maxSets: 2);
        service.SaveSet(Set(SetId)).Should().Be(DjSaveResult.Saved);
        service.SaveSet(Set(OtherSetId)).Should().Be(DjSaveResult.Saved);

        var third = Guid.NewGuid().ToString("D");
        service.SaveSet(Set(third)).Should().Be(DjSaveResult.LimitReached);
        File.Exists(SetFile(third)).Should().BeFalse();
        service.SaveSet(Set(SetId, "Updated")).Should().Be(DjSaveResult.Saved);

        service.DeleteSet(OtherSetId);
        service.SaveSet(Set(third)).Should().Be(DjSaveResult.Saved);
    }

    [Theory]
    [InlineData("")]
    [InlineData("../evil")]
    [InlineData("6F1C2B0E-8D1A-4C7E-9A43-2A1B7C9D0E11")]
    [InlineData("6f1c2b0e8d1a4c7e9a432a1b7c9d0e11")]
    [InlineData("{6f1c2b0e-8d1a-4c7e-9a43-2a1b7c9d0e11}")]
    public void BadSetId_Throws(string id)
    {
        var service = NewService();

        service.Invoking(s => s.GetSet(id)).Should().Throw<ArgumentException>();
        service.Invoking(s => s.DeleteSet(id)).Should().Throw<ArgumentException>();
        service.Invoking(s => s.SaveSet(Set(id))).Should().Throw<ArgumentException>();
        service.Invoking(s => s.SaveLibraryState(new DjLibraryState { CurrentSetId = id })).Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData("")]
    [InlineData("0123456789ABCDEF0123456789ABCDEF")]
    [InlineData("0123456789abcdef0123456789abcde")]
    [InlineData("..\\0123456789abcdef0123456789abcd")]
    public void BadSidHash_Throws(string hash)
    {
        var service = NewService();

        service.Invoking(s => s.GetTuneMemory(hash)).Should().Throw<ArgumentException>();
        service.Invoking(s => s.SaveTuneMemory(Memory(hash))).Should().Throw<ArgumentException>();
    }
}
