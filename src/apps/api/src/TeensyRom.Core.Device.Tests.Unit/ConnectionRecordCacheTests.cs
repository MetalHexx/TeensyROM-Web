using TeensyRom.Core.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Device.Tests.Unit;

/// <summary>
/// Unit tests for <see cref="ConnectionRecordCache"/> covering the missing/malformed-file null cases,
/// the save/load round trip, and the stand-in chip id filter, all against a temp-directory path.
/// </summary>
public class ConnectionRecordCacheTests : IDisposable
{
    private readonly ILoggingService _log;
    private readonly string _testDirectory;
    private readonly string _cacheFilePath;
    private readonly ConnectionRecordCache _sut;

    public ConnectionRecordCacheTests()
    {
        _log = Substitute.For<ILoggingService>();
        _testDirectory = Path.Combine(Path.GetTempPath(), $"TeensyRom_Tests_{Guid.NewGuid()}");
        _cacheFilePath = Path.Combine(_testDirectory, "ConnectionRecords.json");
        _sut = new ConnectionRecordCache(_log, _cacheFilePath);
    }

    public void Dispose()
    {
        if (Directory.Exists(_testDirectory))
        {
            Directory.Delete(_testDirectory, true);
        }
    }

    [Fact]
    public void Load_ReturnsNull_WhenFileMissing()
    {
        _sut.Load().Should().BeNull();
    }

    [Fact]
    public void Load_ReturnsNull_AndLogsParseFailureOnce_WhenJsonMalformed()
    {
        Directory.CreateDirectory(_testDirectory);
        File.WriteAllText(_cacheFilePath, "{ not valid json");

        var result = _sut.Load();

        result.Should().BeNull();
        _log.Received(1).InternalError(Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public void Save_ThenLoad_RoundTripsRows()
    {
        var records = new[]
        {
            new CachedConnectionRecord("chip-1", "COM12", null, ConnectionType.Serial),
            new CachedConnectionRecord("chip-2", null, "192.168.1.37:2112", ConnectionType.Tcp)
        };

        _sut.Save(records);
        var loaded = _sut.Load();

        loaded.Should().NotBeNull();
        loaded.Should().BeEquivalentTo(records);
    }

    [Fact]
    public void Save_DropsRows_WhoseChipIdIsAStandIn()
    {
        var records = new[]
        {
            new CachedConnectionRecord("chip-1", "COM12", null, ConnectionType.Serial),
            new CachedConnectionRecord("Unknown", "COM13", null, ConnectionType.Serial),
            new CachedConnectionRecord("Unknown-2", "COM14", null, ConnectionType.Serial)
        };

        _sut.Save(records);
        var loaded = _sut.Load();

        loaded.Should().NotBeNull();
        loaded.Should().ContainSingle();
        loaded!.Single().ChipId.Should().Be("chip-1");
    }

    [Fact]
    public void Save_WhenAllRowsAreStandIns_LeavesLoadReturningNull()
    {
        var records = new[]
        {
            new CachedConnectionRecord("Unknown", "COM13", null, ConnectionType.Serial)
        };

        _sut.Save(records);
        var loaded = _sut.Load();

        loaded.Should().BeNull();
    }

    [Fact]
    public void Clear_DeletesFile()
    {
        _sut.Save([new CachedConnectionRecord("chip-1", "COM12", null, ConnectionType.Serial)]);
        File.Exists(_cacheFilePath).Should().BeTrue();

        _sut.Clear();

        File.Exists(_cacheFilePath).Should().BeFalse();
    }
}
