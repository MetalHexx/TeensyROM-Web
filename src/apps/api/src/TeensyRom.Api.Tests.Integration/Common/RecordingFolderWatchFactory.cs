using System.Collections.Concurrent;
using TeensyRom.Api.WatchFolders;

namespace TeensyRom.Api.Tests.Integration.Common
{
    /// <summary>
    /// Wraps the real watch factory and records which folders are being watched right now, so a test can wait until
    /// the engine's watcher has actually started (or stopped) a watch instead of guessing with a delay.
    /// </summary>
    public sealed class RecordingFolderWatchFactory(IFolderWatchFactory inner) : IFolderWatchFactory
    {
        private readonly ConcurrentDictionary<Guid, string> _active = new();

        public int ActiveWatchCount => _active.Count;

        public bool IsWatching(string folderPath) =>
            _active.Values.Any(p => WatchFolderPaths.AreSame(p, folderPath));

        public IDisposable Watch(string folderPath, Action<FolderEvent> onEvent, Action<Exception> onError)
        {
            var watch = inner.Watch(folderPath, onEvent, onError);
            var id = Guid.NewGuid();
            _active[id] = folderPath;

            return new Registration(watch, () => _active.TryRemove(id, out _));
        }

        private sealed class Registration(IDisposable watch, Action onDispose) : IDisposable
        {
            public void Dispose()
            {
                watch.Dispose();
                onDispose();
            }
        }
    }
}
