using System.Diagnostics;
using System.Reactive.Linq;
using System.Reactive.Subjects;
using System.Text;

namespace TeensyRom.Cli.Logging
{
    public abstract class LoggingService : ILoggingService
    {
        public IObservable<string> Logs => _logs.AsObservable();
        protected Subject<string> _logs = new();
        private string _logPath => LogConstants.LogPath;

        private const long MaxLogBytes = 1024 * 1024;
        private const int WriteAttempts = 3;
        private static readonly TimeSpan RetryDelay = TimeSpan.FromMilliseconds(10);

        /// <summary>
        /// Several <c>trom</c> processes share one log file, so construction never deletes or truncates it.
        /// A file over 1 MB is moved to <c>Logs.old.txt</c> instead, best effort.
        /// </summary>
        protected LoggingService()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(_logPath)!);

                if (new FileInfo(_logPath) is { Exists: true, Length: > MaxLogBytes })
                {
                    File.Move(_logPath, Path.Combine(Path.GetDirectoryName(_logPath)!, "Logs.old.txt"), overwrite: true);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Log setup failed: {ex.Message}");
            }
        }

        public virtual void Internal(string message, bool newLine = true) => Log(message, LogConstants.InternalColor, newLine);
        public virtual void InternalSuccess(string message, bool newLine = true) => Log(message, LogConstants.InternalSuccessColor, newLine);
        public virtual void InternalError(string message, bool newLine = true) => Log(message, LogConstants.InternalErrorColor, newLine);
        public virtual void External(string message, bool newLine = true) => Log($"[TR]: {message}", LogConstants.ExternalColor, newLine);
        public virtual void ExternalSuccess(string message, bool newLine = true) => Log($"[TR]: {message}", LogConstants.ExternalSuccessColor, newLine);
        public virtual void ExternalError(string message, bool newLine = true) => Log($"[TR]: {message}", LogConstants.ExternalErrorColor, newLine);

        private static readonly object _logFileLock = new object();

        /// <summary>
        /// Appends a line to the shared log file. Never throws: when another process holds the file the write is
        /// retried briefly, then the line is dropped, because a lost log line must not fail the command logging it.
        /// </summary>
        public virtual void Log(string message, string hExColor, bool newLine = true)
        {
            var line = Encoding.UTF8.GetBytes(message + Environment.NewLine);

            lock (_logFileLock)
            {
                for (var attempt = 1; attempt <= WriteAttempts; attempt++)
                {
                    try
                    {
                        using var stream = new FileStream(_logPath, FileMode.Append, FileAccess.Write, FileShare.ReadWrite | FileShare.Delete);
                        stream.Write(line);
                        return;
                    }
                    catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                    {
                        if (attempt == WriteAttempts)
                        {
                            Debug.WriteLine($"Log write dropped: {ex.Message}");
                            return;
                        }
                        Thread.Sleep(RetryDelay);
                    }
                }
            }
        }
    }
}