using System.Collections.Concurrent;
using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using TeensyRom.Api.Transfers.Archives;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.WatchFolders
{
    /// <summary>
    /// Watches every enabled watch folder and sends what arrives in it to the folder's destinations. One loop owns all
    /// watch state: watcher callbacks, settings changes and the poll timer only post messages to a channel, so nothing
    /// is started or stopped from a callback (a settings change arrives synchronously under the settings lock).
    /// Reports each folder's live state as the <see cref="IWatchFolderStatus"/>.
    /// </summary>
    public sealed class WatchFolderWatcher(
        IWatchFolderStore store,
        IFolderWatchFactory watchFactory,
        IWatchedFileSystem fileSystem,
        IArchiveReader archives,
        WatchFolderDelivery delivery,
        WatchFolderOptions options,
        TimeProvider time,
        ILoggingService log) : BackgroundService, IWatchFolderStatus
    {
        private readonly Channel<Message> _messages = Channel.CreateUnbounded<Message>(new UnboundedChannelOptions { SingleReader = true });

        // Owned by the loop.
        private readonly Dictionary<string, Watch> _watches = [];
        private int _lastGeneration;
        private DateTimeOffset _lastAvailabilityCheck;

        // Folders recorded as failed or gone: written by the loop, read by GetState from any thread.
        private readonly ConcurrentDictionary<string, bool> _unavailable = new();

        /// <summary>
        /// Off when disabled; Unavailable when the directory is missing (checked now) or the watcher recorded a failed
        /// start or watch error; otherwise Watching, so a folder just added or turned on reads Watching before the
        /// loop has picked it up.
        /// </summary>
        public WatchFolderState GetState(WatchFolder folder)
        {
            if (!folder.Enabled) return WatchFolderState.Off;

            return !fileSystem.DirectoryExists(folder.Path) || _unavailable.ContainsKey(folder.Id)
                ? WatchFolderState.Unavailable
                : WatchFolderState.Watching;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await Task.Yield();

            using var subscription = store.Changed.Subscribe(_ => _messages.Writer.TryWrite(Message.Reconcile));
            _lastAvailabilityCheck = time.GetUtcNow();
            var ticker = PostTicksAsync(stoppingToken);

            try
            {
                await foreach (var message in _messages.Reader.ReadAllAsync(stoppingToken))
                {
                    try
                    {
                        Handle(message, stoppingToken);
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        log.InternalError($"Watch folders: failed to handle {message.GetType().Name}: {ex.Message}");
                    }
                }
            }
            catch (OperationCanceledException)
            {
            }
            finally
            {
                foreach (var id in _watches.Keys.ToList()) StopWatching(id);
                await ticker;
            }
        }

        private async Task PostTicksAsync(CancellationToken ct)
        {
            using var timer = new PeriodicTimer(options.PollInterval, time);

            try
            {
                while (await timer.WaitForNextTickAsync(ct))
                {
                    _messages.Writer.TryWrite(Message.Tick);
                }
            }
            catch (OperationCanceledException)
            {
            }
        }

        private void Handle(Message message, CancellationToken ct)
        {
            switch (message)
            {
                case EventMessage e when Current(e.FolderId, e.Generation) is { Tracker: not null } watch:
                    watch.Tracker.OnEvent(e.Event, time.GetUtcNow());
                    break;
                case ErrorMessage e when Current(e.FolderId, e.Generation) is { Subscription: not null } watch:
                    OnWatchError(watch, e.Error);
                    break;
                case TickMessage:
                    OnTick(ct);
                    break;
                case ReconcileMessage:
                    Reconcile();
                    break;
            }
        }

        private Watch? Current(string folderId, int generation) =>
            _watches.TryGetValue(folderId, out var watch) && watch.Generation == generation ? watch : null;

        private void Reconcile()
        {
            var enabled = new Dictionary<string, WatchFolder>();
            foreach (var folder in store.GetAll().Where(f => f.Enabled)) enabled.TryAdd(folder.Id, folder);

            foreach (var id in _watches.Keys.Where(id => !enabled.ContainsKey(id)).ToList()) StopWatching(id);

            foreach (var folder in enabled.Values)
            {
                if (_watches.TryGetValue(folder.Id, out var watch))
                {
                    if (WatchFolderPaths.AreSame(watch.Folder.Path, folder.Path))
                    {
                        watch.Folder = folder;
                        continue;
                    }

                    StopWatching(folder.Id);
                }

                var added = new Watch(folder);
                _watches[folder.Id] = added;
                TryStart(added);
            }
        }

        private void OnTick(CancellationToken ct)
        {
            var now = time.GetUtcNow();

            foreach (var watch in _watches.Values.ToList())
            {
                if (watch.Tracker is null) continue;

                try
                {
                    foreach (var set in watch.Tracker.Tick(now)) Dispatch(watch.Folder, set, ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    log.InternalError($"Watch folder {watch.Folder.Path}: failed to check for arrivals: {ex.Message}");
                }
            }

            if (now - _lastAvailabilityCheck < options.UnavailableRetryInterval) return;

            _lastAvailabilityCheck = now;
            CheckAvailability();
        }

        /// <summary>
        /// A <see cref="FileSystemWatcher"/> does not reliably report its own directory being deleted, so a watched
        /// folder is checked for existence, and a folder that cannot be watched is tried again.
        /// </summary>
        private void CheckAvailability()
        {
            foreach (var watch in _watches.Values.ToList())
            {
                if (watch.Subscription is null)
                {
                    TryStart(watch);
                }
                else if (!fileSystem.DirectoryExists(watch.Folder.Path))
                {
                    MarkUnavailable(watch, "the folder no longer exists");
                }
            }
        }

        private void TryStart(Watch watch)
        {
            if (!fileSystem.DirectoryExists(watch.Folder.Path))
            {
                MarkUnavailable(watch, "the folder was not found");
                return;
            }

            var folderId = watch.Folder.Id;
            var generation = watch.Generation = ++_lastGeneration;

            try
            {
                watch.Subscription = watchFactory.Watch(
                    watch.Folder.Path,
                    e => _messages.Writer.TryWrite(new EventMessage(folderId, generation, e)),
                    ex => _messages.Writer.TryWrite(new ErrorMessage(folderId, generation, ex)));
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                MarkUnavailable(watch, ex.Message);
                return;
            }

            watch.Tracker = new ArrivalTracker(folderId, watch.Folder.Path, options, fileSystem, archives, log);

            if (_unavailable.TryRemove(folderId, out _))
            {
                log.Internal($"Watch folder {watch.Folder.Path} is available again and being watched.");
            }
        }

        private void OnWatchError(Watch watch, Exception error)
        {
            if (error is InternalBufferOverflowException)
            {
                log.InternalWarning(
                    $"Watch folder {watch.Folder.Path} missed some file events because its event buffer overflowed; files that arrived meanwhile may not have been sent.");
                return;
            }

            MarkUnavailable(watch, error.Message);
        }

        private void MarkUnavailable(Watch watch, string reason)
        {
            if (_unavailable.TryAdd(watch.Folder.Id, true))
            {
                log.InternalWarning(
                    $"Watch folder {watch.Folder.Path} is unavailable: {reason}. It is checked again every {options.UnavailableRetryInterval.TotalSeconds:0.##} seconds.");
            }

            watch.Subscription?.Dispose();
            watch.Subscription = null;
            watch.Tracker = null;
        }

        private void StopWatching(string folderId)
        {
            if (_watches.Remove(folderId, out var watch)) watch.Subscription?.Dispose();

            _unavailable.TryRemove(folderId, out _);
        }

        private void Dispatch(WatchFolder folder, ArrivalSet set, CancellationToken ct) =>
            _ = Task.Run(async () =>
            {
                try
                {
                    await delivery.DeliverAsync(folder, set, ct);
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                }
                catch (Exception ex)
                {
                    log.InternalError($"Watch folder {folder.Path}: failed to deliver its arrivals: {ex.Message}");
                }
            }, CancellationToken.None);

        private sealed class Watch(WatchFolder folder)
        {
            public WatchFolder Folder { get; set; } = folder;

            /// <summary>Tells a watch's late events from those of the watch that replaced it.</summary>
            public int Generation { get; set; }

            /// <summary>Null while the folder cannot be watched.</summary>
            public IDisposable? Subscription { get; set; }

            public ArrivalTracker? Tracker { get; set; }
        }

        private abstract record Message
        {
            public static readonly Message Reconcile = new ReconcileMessage();
            public static readonly Message Tick = new TickMessage();
        }

        private sealed record ReconcileMessage : Message;

        private sealed record TickMessage : Message;

        private sealed record EventMessage(string FolderId, int Generation, FolderEvent Event) : Message;

        private sealed record ErrorMessage(string FolderId, int Generation, Exception Error) : Message;
    }
}
