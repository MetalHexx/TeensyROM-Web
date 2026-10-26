using System.Collections.Concurrent;
using System.Reactive.Subjects;
using Microsoft.Extensions.Time.Testing;
using TeensyRom.Api.Transfers;
using TeensyRom.Api.Transfers.Archives;
using TeensyRom.Api.WatchFolders;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.WatchFolders;

/// <summary>
/// The watcher's loop against a fake watch factory, a fake file system and a fake clock: which folders are watched,
/// what state they report, what happens when a folder goes missing or its watch fails, and that arrivals reach the
/// transfer service. The arrival rules themselves are covered by <see cref="ArrivalTrackerTests"/>.
/// </summary>
public class WatchFolderWatcherTests : IAsyncLifetime
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(15);

    private readonly string _root = Path.Combine(Path.GetTempPath(), "tr-watcher-root");
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero));
    private readonly FakeWatchedFileSystem _fs = new();
    private readonly FakeFolderWatchFactory _factory = new();
    private readonly FakeWatchFolderStore _store = new();
    private readonly ITransferJobService _jobs = Substitute.For<ITransferJobService>();
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly ConcurrentQueue<TransferJobStart> _starts = new();
    private readonly ConcurrentQueue<string> _sent = new();
    private readonly WatchFolderOptions _options = new()
    {
        SettleTime = TimeSpan.FromSeconds(2),
        PollInterval = TimeSpan.FromMilliseconds(500),
        GroupingWindow = TimeSpan.FromSeconds(3),
        MaxSetHold = TimeSpan.FromMinutes(1),
        UnavailableRetryInterval = TimeSpan.FromSeconds(10)
    };
    private readonly WatchFolderWatcher _watcher;

    public WatchFolderWatcherTests()
    {
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetOfflineDevices().Returns([]);

        _jobs.Start(Arg.Do<TransferJobStart>(_starts.Enqueue)).Returns(call =>
        {
            var request = call.Arg<TransferJobStart>();
            return new TransferStartResult(
                new TransferJob(request.DeviceId, request.StorageType, new DirectoryPath(request.DestinationDirectory), new TransferOptions()), null, null, null);
        });
        _jobs.AddFileAsync(Arg.Any<TransferJob>(), Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<long?>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                _sent.Enqueue(call.ArgAt<string>(2));
                return Task.FromResult(new TransferFileResult(true, 0, null));
            });
        _jobs.Seal(Arg.Any<TransferJob>()).Returns(new TransferSealResult(true, null));

        var delivery = new WatchFolderDelivery(_jobs, _store, _fs, devices, _log);
        _watcher = new WatchFolderWatcher(_store, _factory, _fs, Substitute.For<IArchiveReader>(), delivery, _options, _time, _log);

        _fs.AddDirectory(_root);
    }

    public async Task InitializeAsync() => await _watcher.StartAsync(CancellationToken.None);

    public async Task DisposeAsync() => await _watcher.StopAsync(CancellationToken.None);

    private string FolderPath(string name) => Path.Combine(_root, name);

    private WatchFolder AddFolder(string id, bool enabled = true, bool exists = true)
    {
        var folder = new WatchFolder
        {
            Id = id,
            Path = FolderPath(id),
            Enabled = enabled,
            Destinations = [new WatchFolderDestination { Id = $"d-{id}", DeviceId = "dev-1", StorageType = TeensyStorageType.SD, Path = "/auto/" }]
        };
        if (exists) _fs.AddDirectory(folder.Path);
        return folder;
    }

    private static async Task Eventually(Func<bool> condition, string what, Action? between = null)
    {
        var deadline = DateTime.UtcNow + Timeout;
        while (!condition())
        {
            if (DateTime.UtcNow > deadline) throw new TimeoutException($"Timed out waiting for {what}.");
            between?.Invoke();
            await Task.Delay(5);
        }
    }

    private Task EventuallyAsTimePasses(Func<bool> condition, string what) =>
        Eventually(condition, what, () => _time.Advance(_options.PollInterval));

    private async Task PassTime(TimeSpan span)
    {
        for (var passed = TimeSpan.Zero; passed < span; passed += _options.PollInterval)
        {
            _time.Advance(_options.PollInterval);
            await Task.Delay(5);
        }
    }

    private void Arrive(string folderId, string fileName, long size = 100)
    {
        var path = Path.Combine(FolderPath(folderId), fileName);
        _fs.AddFile(path, size);
        _factory.Active(FolderPath(folderId)).Raise(new FolderEvent(FolderEventKind.Created, path));
    }

    private int WarningsAbout(string text) =>
        _log.ReceivedCalls()
            .Where(c => c.GetMethodInfo().Name == nameof(ILoggingService.InternalWarning))
            .Count(c => ((string)c.GetArguments()[0]!).Contains(text));

    [Fact]
    public async Task OnlyEnabledFoldersAreWatched_AndAFolderTurnedOnOrAddedLaterIsPickedUp()
    {
        _store.Set(AddFolder("a"), AddFolder("b", enabled: false));
        await Eventually(() => _factory.IsWatching(FolderPath("a")), "folder a to be watched");

        _factory.IsWatching(FolderPath("b")).Should().BeFalse();

        _store.Set(AddFolder("a"), AddFolder("b"), AddFolder("c"));
        await Eventually(() => _factory.IsWatching(FolderPath("b")) && _factory.IsWatching(FolderPath("c")), "folders b and c to be watched");
    }

    [Fact]
    public async Task FolderRemovedOrTurnedOff_StopsBeingWatched()
    {
        _store.Set(AddFolder("a"), AddFolder("b"));
        await Eventually(() => _factory.IsWatching(FolderPath("a")) && _factory.IsWatching(FolderPath("b")), "both watched");

        _store.Set(AddFolder("a", enabled: false));

        await Eventually(() => !_factory.IsWatching(FolderPath("a")) && !_factory.IsWatching(FolderPath("b")), "both watches to stop");
    }

    [Fact]
    public async Task ASettingsChange_OnlyPostsAMessage_ItNeverStartsAWatchOnTheCallersThread()
    {
        var callerThread = Environment.CurrentManagedThreadId;

        _store.Set(AddFolder("a"));
        await Eventually(() => _factory.IsWatching(FolderPath("a")), "folder a to be watched");

        _factory.Watches.Should().OnlyContain(w => w.StartedOnThread != callerThread);
    }

    [Fact]
    public async Task ArrivalInAWatchedFolder_ReachesTheTransferServiceFromThatWatchFolder()
    {
        _store.Set(AddFolder("a"));
        await Eventually(() => _factory.IsWatching(FolderPath("a")), "folder a to be watched");

        Arrive("a", "tune.sid");

        await EventuallyAsTimePasses(() => !_sent.IsEmpty, "the arrival to be sent");
        var start = _starts.Should().ContainSingle().Subject;
        start.Origin.WatchFolderId.Should().Be("a");
        start.DeviceId.Should().Be("dev-1");
        _sent.Should().Equal("tune.sid");
    }

    [Fact]
    public async Task FilesAlreadyInAFolder_AreNotSentWhenItIsTurnedOn_OnlyLaterArrivals()
    {
        _fs.AddFile(Path.Combine(FolderPath("a"), "old.sid"), 100);
        _store.Set(AddFolder("a", enabled: false));
        await PassTime(TimeSpan.FromSeconds(1));

        _store.Set(AddFolder("a"));
        await Eventually(() => _factory.IsWatching(FolderPath("a")), "folder a to be watched");
        await PassTime(TimeSpan.FromSeconds(15));
        Arrive("a", "new.sid");

        await EventuallyAsTimePasses(() => !_sent.IsEmpty, "the new arrival to be sent");
        _sent.Should().Equal("new.sid");
    }

    [Fact]
    public async Task DisabledFolder_SendsNothing_AndAFileArrivingWhileOffIsNotSentWhenItIsTurnedBackOn()
    {
        _store.Set(AddFolder("a"));
        await Eventually(() => _factory.IsWatching(FolderPath("a")), "folder a to be watched");
        var firstWatch = _factory.Active(FolderPath("a"));

        _store.Set(AddFolder("a", enabled: false));
        await Eventually(() => firstWatch.Disposed, "the watch to stop");
        _fs.AddFile(Path.Combine(FolderPath("a"), "while-off.sid"), 100);
        await PassTime(TimeSpan.FromSeconds(15));

        _store.Set(AddFolder("a"));
        await Eventually(() => _factory.IsWatching(FolderPath("a")), "folder a to be watched again");
        Arrive("a", "after.sid");

        await EventuallyAsTimePasses(() => !_sent.IsEmpty, "the later arrival to be sent");
        _sent.Should().Equal("after.sid");
    }

    [Fact]
    public void State_IsOffWhenDisabled_UnavailableWhenTheDirectoryIsMissing_AndWatchingForAFolderNotYetPickedUp()
    {
        var on = AddFolder("on");
        var off = AddFolder("off", enabled: false);
        var missing = AddFolder("missing", exists: false);

        _watcher.GetState(on).Should().Be(WatchFolderState.Watching);
        _watcher.GetState(off).Should().Be(WatchFolderState.Off);
        _watcher.GetState(missing).Should().Be(WatchFolderState.Unavailable);
    }

    [Fact]
    public async Task FolderMissingAtStart_IsUnavailableAndLoggedOnce_ThenWatchedWhenItAppears()
    {
        var folder = AddFolder("a", exists: false);
        _store.Set(folder);

        await PassTime(TimeSpan.FromSeconds(35));
        _watcher.GetState(folder).Should().Be(WatchFolderState.Unavailable);
        _factory.Watches.Should().BeEmpty();
        WarningsAbout(folder.Path).Should().Be(1, "a transition is logged once, not on every retry");

        _fs.AddDirectory(folder.Path);

        await EventuallyAsTimePasses(() => _factory.IsWatching(folder.Path), "the folder to be watched once it exists");
        _watcher.GetState(folder).Should().Be(WatchFolderState.Watching);
    }

    [Fact]
    public async Task WatchedFolderThatIsDeleted_IsTornDownAndUnavailable_AndResumesWhenRecreated()
    {
        var folder = AddFolder("a");
        _store.Set(folder);
        await Eventually(() => _factory.IsWatching(folder.Path), "folder a to be watched");
        var firstWatch = _factory.Active(folder.Path);

        _fs.Remove(folder.Path);

        await EventuallyAsTimePasses(() => firstWatch.Disposed, "the watch of the deleted folder to be torn down");
        _watcher.GetState(folder).Should().Be(WatchFolderState.Unavailable);
        WarningsAbout(folder.Path).Should().Be(1);

        _fs.AddDirectory(folder.Path);

        await EventuallyAsTimePasses(() => _factory.IsWatching(folder.Path), "watching to resume");
        _watcher.GetState(folder).Should().Be(WatchFolderState.Watching);
        Arrive("a", "back.sid");
        await EventuallyAsTimePasses(() => !_sent.IsEmpty, "an arrival after the folder came back");
    }

    [Fact]
    public async Task WatchError_MarksTheFolderUnavailable_AndItIsRetried()
    {
        var folder = AddFolder("a");
        _store.Set(folder);
        await Eventually(() => _factory.IsWatching(folder.Path), "folder a to be watched");
        var firstWatch = _factory.Active(folder.Path);

        firstWatch.Fail(new IOException("the network name is no longer available"));

        await Eventually(() => firstWatch.Disposed, "the failed watch to be torn down");
        _watcher.GetState(folder).Should().Be(WatchFolderState.Unavailable);

        await EventuallyAsTimePasses(() => _factory.IsWatching(folder.Path), "the watch to be retried");
        _watcher.GetState(folder).Should().Be(WatchFolderState.Watching);
        WarningsAbout(folder.Path).Should().Be(1);
    }

    [Fact]
    public async Task FolderWhoseWatchCannotStart_IsUnavailableUntilTheRetrySucceeds()
    {
        var folder = AddFolder("a");
        _factory.FailWith = _ => new IOException("too many watches");
        _store.Set(folder);

        await Eventually(() => _watcher.GetState(folder) == WatchFolderState.Unavailable, "the failed start to be recorded");

        _factory.FailWith = null;
        await EventuallyAsTimePasses(() => _factory.IsWatching(folder.Path), "the retry to succeed");
        _watcher.GetState(folder).Should().Be(WatchFolderState.Watching);
    }

    [Fact]
    public async Task BufferOverflow_IsLoggedAsMissedArrivals_AndTheWatchKeepsGoing()
    {
        var folder = AddFolder("a");
        _store.Set(folder);
        await Eventually(() => _factory.IsWatching(folder.Path), "folder a to be watched");
        var watch = _factory.Active(folder.Path);

        watch.Fail(new InternalBufferOverflowException());

        await Eventually(() => WarningsAbout(folder.Path) == 1, "the overflow to be logged");
        watch.Disposed.Should().BeFalse();
        _watcher.GetState(folder).Should().Be(WatchFolderState.Watching);

        Arrive("a", "after.sid");
        await EventuallyAsTimePasses(() => !_sent.IsEmpty, "an arrival after the overflow");
    }
}

internal sealed class FakeWatch(string path, Action<FolderEvent> onEvent, Action<Exception> onError) : IDisposable
{
    private volatile bool _disposed;

    public string Path { get; } = path;
    public int StartedOnThread { get; } = Environment.CurrentManagedThreadId;
    public bool Disposed => _disposed;

    public void Raise(FolderEvent e) => onEvent(e);

    public void Fail(Exception error) => onError(error);

    public void Dispose() => _disposed = true;
}

internal sealed class FakeFolderWatchFactory : IFolderWatchFactory
{
    private readonly ConcurrentQueue<FakeWatch> _watches = new();

    public Func<string, Exception?>? FailWith { get; set; }

    public IReadOnlyList<FakeWatch> Watches => [.. _watches];

    public IDisposable Watch(string folderPath, Action<FolderEvent> onEvent, Action<Exception> onError)
    {
        var failure = FailWith?.Invoke(folderPath);
        if (failure is not null) throw failure;

        var watch = new FakeWatch(folderPath, onEvent, onError);
        _watches.Enqueue(watch);
        return watch;
    }

    public bool IsWatching(string path) => _watches.Any(w => w.Path == path && !w.Disposed);

    public FakeWatch Active(string path) => _watches.Last(w => w.Path == path && !w.Disposed);
}

internal sealed class FakeWatchFolderStore : IWatchFolderStore
{
    private readonly BehaviorSubject<IReadOnlyList<WatchFolder>> _folders = new([]);

    public void Set(params WatchFolder[] folders) => _folders.OnNext(folders);

    public IObservable<IReadOnlyList<WatchFolder>> Changed => _folders;

    public IReadOnlyList<WatchFolder> GetAll() => _folders.Value;

    public WatchFolder? Get(string watchFolderId) => _folders.Value.FirstOrDefault(f => f.Id == watchFolderId);

    public WatchFolderAddResult Add(WatchFolderAdd request) => throw new NotSupportedException();

    public bool RemoveFolder(string watchFolderId) => throw new NotSupportedException();

    public WatchFolderRemoveDeviceResult RemoveDevice(string watchFolderId, string deviceId) => throw new NotSupportedException();

    public WatchFolder? SetEnabled(string watchFolderId, bool enabled) => throw new NotSupportedException();
}
