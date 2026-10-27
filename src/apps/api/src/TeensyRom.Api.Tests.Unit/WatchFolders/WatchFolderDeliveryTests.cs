using System.Collections.Concurrent;
using TeensyRom.Api.Transfers;
using TeensyRom.Api.WatchFolders;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.WatchFolders;

public class WatchFolderDeliveryTests
{
    private const string WatchPath = "/watch";

    private readonly ITransferJobService _jobs = Substitute.For<ITransferJobService>();
    private readonly IWatchFolderStore _store = Substitute.For<IWatchFolderStore>();
    private readonly IDeviceConnectionManager _devices = Substitute.For<IDeviceConnectionManager>();
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly FakeWatchedFileSystem _fs = new();
    private readonly ConcurrentQueue<TransferJobStart> _starts = new();
    private readonly ConcurrentDictionary<string, List<string>> _added = new();
    private readonly ConcurrentQueue<string> _sealed = new();
    private readonly WatchFolderDelivery _delivery;

    public WatchFolderDeliveryTests()
    {
        _devices.GetOfflineDevices().Returns([]);
        _jobs.Start(Arg.Do<TransferJobStart>(_starts.Enqueue)).Returns(call => Started(call.Arg<TransferJobStart>()));
        _jobs.AddFileAsync(Arg.Any<TransferJob>(), Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<long?>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                var path = call.ArgAt<string>(2);
                _added.GetOrAdd(call.Arg<TransferJob>().DeviceId, _ => []).Add(path);
                return Task.FromResult(new TransferFileResult(true, call.ArgAt<long?>(3) ?? 0, null));
            });
        _jobs.Seal(Arg.Any<TransferJob>()).Returns(call =>
        {
            _sealed.Enqueue(call.Arg<TransferJob>().DeviceId);
            return new TransferSealResult(true, null);
        });

        _delivery = new WatchFolderDelivery(_jobs, _store, _fs, _devices, _log);
    }

    private static TransferStartResult Started(TransferJobStart request) =>
        new(new TransferJob(request.DeviceId, request.StorageType, new DirectoryPath(request.DestinationDirectory), new TransferOptions()), null, null, null);

    private static TransferStartResult Refused(TransferStartError error) => new(null, error, "refused", null);

    private static WatchFolderDestination Destination(string deviceId, TeensyStorageType storage = TeensyStorageType.SD, string path = "/auto/", bool launch = false) =>
        new() { Id = $"d-{deviceId}", DeviceId = deviceId, StorageType = storage, Path = path, Launch = launch };

    private WatchFolder Folder(params WatchFolderDestination[] destinations)
    {
        var folder = new WatchFolder { Id = "w1", Path = WatchPath, Enabled = true, Destinations = [.. destinations] };
        _store.Get("w1").Returns(folder);
        return folder;
    }

    private ArrivedFile File(string relative, long size = 10, bool archive = false)
    {
        var path = $"{WatchPath}/{relative}";
        _fs.AddFile(path.Replace('/', Path.DirectorySeparatorChar), size);
        return new ArrivedFile(path.Replace('/', Path.DirectorySeparatorChar), relative, size, archive);
    }

    private Task Deliver(WatchFolder folder, params ArrivedFile[] files) =>
        _delivery.DeliverAsync(folder, new ArrivalSet(folder.Id, files), CancellationToken.None);

    [Fact]
    public async Task EachDestination_GetsItsOwnJobFromTheWatchFolder_WithEveryFile_ArchivesFirst_ThenSealed()
    {
        var folder = Folder(Destination("dev-a", TeensyStorageType.SD, "/music/"), Destination("dev-b", TeensyStorageType.USB, "/games/", launch: true));

        await Deliver(folder, File("tune.sid"), File("pack.zip", archive: true), File("sub/game.prg"));

        _starts.Should().HaveCount(2);
        var a = _starts.Single(s => s.DeviceId == "dev-a");
        a.StorageType.Should().Be(TeensyStorageType.SD);
        a.DestinationDirectory.Should().Be("/music/");
        a.ExpectedArchiveCount.Should().Be(1);
        a.Origin.Should().Be(TransferOrigin.FromWatchFolder("w1", WatchPath));
        a.LaunchRequested.Should().BeFalse();
        _starts.Single(s => s.DeviceId == "dev-b").LaunchRequested.Should().BeTrue();

        foreach (var device in new[] { "dev-a", "dev-b" })
        {
            _added[device].Should().Equal("pack.zip", "tune.sid", "sub/game.prg");
        }

        _sealed.Should().BeEquivalentTo("dev-a", "dev-b");
    }

    [Theory]
    [InlineData(TransferStartError.DeviceNotFound)]
    [InlineData(TransferStartError.StorageUnavailable)]
    [InlineData(TransferStartError.DeviceBusy)]
    [InlineData(TransferStartError.InvalidDestination)]
    public async Task DestinationThatCannotStart_IsSkippedWithOneLogLineAndNothingElse(TransferStartError error)
    {
        var folder = Folder(Destination("dev-a"));
        _jobs.Start(Arg.Any<TransferJobStart>()).Returns(Refused(error));

        await Deliver(folder, File("tune.sid"));

        _log.Received(1).InternalWarning(Arg.Any<string>(), "dev-a");
        await _jobs.DidNotReceiveWithAnyArgs().AddFileAsync(default!, default!, default!, default, default);
        _jobs.DidNotReceiveWithAnyArgs().Seal(default!);
    }

    [Fact]
    public async Task BusyDestination_DoesNotStopTheOtherOne()
    {
        var folder = Folder(Destination("dev-a"), Destination("dev-b"));
        _jobs.Start(Arg.Is<TransferJobStart>(s => s.DeviceId == "dev-a")).Returns(Refused(TransferStartError.DeviceBusy));

        await Deliver(folder, File("tune.sid"));

        _log.Received(1).InternalWarning(Arg.Any<string>(), "dev-a");
        _added.Should().ContainKey("dev-b").WhoseValue.Should().Equal("tune.sid");
        _sealed.Should().Equal("dev-b");
    }

    [Fact]
    public async Task DestinationThatThrowsOnStart_DoesNotStopTheOtherOne()
    {
        var folder = Folder(Destination("dev-a"), Destination("dev-b"));
        _jobs.Start(Arg.Is<TransferJobStart>(s => s.DeviceId == "dev-a")).Returns(_ => throw new InvalidOperationException("boom"));

        await Deliver(folder, File("tune.sid"));

        _log.Received(1).InternalError(Arg.Any<string>(), "dev-a");
        _sealed.Should().Equal("dev-b");
    }

    [Fact]
    public async Task FileThatIsRefusedOrUnreadable_IsLogged_AndTheRestStillGoOut_ThenSealed()
    {
        var folder = Folder(Destination("dev-a"));
        var refused = File("refused.sid");
        var vanished = new ArrivedFile(Path.Combine("/gone", "vanished.sid"), "vanished.sid", 10, false);
        var fine = File("fine.sid");
        _jobs.AddFileAsync(Arg.Any<TransferJob>(), Arg.Any<Stream>(), "refused.sid", Arg.Any<long?>(), Arg.Any<CancellationToken>())
            .Returns(new TransferFileResult(false, 0, "no room"));

        await Deliver(folder, refused, vanished, fine);

        _log.Received(2).InternalWarning(Arg.Any<string>(), "dev-a");
        _added["dev-a"].Should().Contain("fine.sid");
        _sealed.Should().Equal("dev-a");
    }

    [Fact]
    public async Task Seal_IsCalledEvenWhenTheDeliveryIsCancelledMidway()
    {
        var folder = Folder(Destination("dev-a"));
        using var cts = new CancellationTokenSource();
        _jobs.AddFileAsync(Arg.Any<TransferJob>(), Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<long?>(), Arg.Any<CancellationToken>())
            .Returns<Task<TransferFileResult>>(_ =>
            {
                cts.Cancel();
                throw new OperationCanceledException(cts.Token);
            });

        await _delivery.DeliverAsync(folder, new ArrivalSet(folder.Id, [File("one.sid"), File("two.sid")]), cts.Token);

        _sealed.Should().Equal("dev-a");
        _log.DidNotReceiveWithAnyArgs().InternalError(default!, default);
    }

    [Fact]
    public async Task FolderRemovedOrDisabledSinceTheSetClosed_SendsNothing()
    {
        var folder = Folder(Destination("dev-a"));
        _store.Get("w1").Returns((WatchFolder?)null);
        await Deliver(folder, File("tune.sid"));

        _store.Get("w1").Returns(folder with { Enabled = false });
        await Deliver(folder, File("tune.sid"));

        _jobs.DidNotReceiveWithAnyArgs().Start(default!);
    }

    [Fact]
    public async Task DestinationsAreReadFromTheStoreAtDeliveryTime()
    {
        var stale = Folder(Destination("dev-a"));
        _store.Get("w1").Returns(stale with { Destinations = [Destination("dev-c")] });

        await Deliver(stale, File("tune.sid"));

        _starts.Should().ContainSingle().Which.DeviceId.Should().Be("dev-c");
    }
}
