using TeensyRom.Core.Common;

namespace TeensyRom.Api.Startup
{
    /// <summary>
    /// Guarantees one engine per home. The engine holds <c>engine.lock</c> open exclusively for the life of the
    /// process; the OS releases it when the process ends, so a crash never leaves a stale lock behind.
    /// </summary>
    public static class EngineInstanceLock
    {
        private static readonly TimeSpan DefaultRetryWindow = TimeSpan.FromSeconds(2);
        private static readonly TimeSpan DefaultRetryInterval = TimeSpan.FromMilliseconds(200);

        private static readonly object _gate = new();
        private static readonly Dictionary<string, FileStream> _held = [];

        /// <summary>
        /// Takes the engine lock for the home at <paramref name="apiPath"/>. Re-entrant: a path this process
        /// already holds succeeds again, since a test process boots the engine many times.
        /// </summary>
        /// <returns>False when another process holds the lock for the whole retry window.</returns>
        public static bool TryAcquire(string apiPath) => TryAcquire(apiPath, DefaultRetryWindow, DefaultRetryInterval);

        /// <summary>
        /// Retries for <paramref name="retryWindow"/> because a CLI's momentary probe of the lock file can
        /// collide with a starting engine.
        /// </summary>
        public static bool TryAcquire(string apiPath, TimeSpan retryWindow, TimeSpan retryInterval)
        {
            var lockPath = Path.GetFullPath(Path.Combine(apiPath, TeensyRomHome.EngineLockFileName));

            lock (_gate)
            {
                if (_held.ContainsKey(lockPath)) return true;

                Directory.CreateDirectory(apiPath);

                var deadline = DateTime.UtcNow + retryWindow;

                while (true)
                {
                    try
                    {
                        _held[lockPath] = new FileStream(lockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
                        return true;
                    }
                    catch (IOException) when (DateTime.UtcNow < deadline)
                    {
                        Thread.Sleep(retryInterval);
                    }
                    catch (IOException)
                    {
                        return false;
                    }
                }
            }
        }
    }
}
