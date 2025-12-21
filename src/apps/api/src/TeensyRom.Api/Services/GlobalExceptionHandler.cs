using System.Diagnostics;
using System.Reflection;
using System.Text;
using TeensyRom.Core.Common;

namespace TeensyRom.Api.Services
{
    /// <summary>
    /// Global exception handler for unhandled exceptions at the process level.
    /// Logs fatal errors that escape middleware and normal exception handling.
    /// </summary>
    public static class GlobalExceptionHandler
    {
        private static readonly string _logPath;
        private static readonly object _fileLock = new();
        private static bool _initialized = false;

        static GlobalExceptionHandler()
        {
            _logPath = Path.Combine(Assembly.GetExecutingAssembly().GetDataPath(), "Assets", "System", "Logs");
        }

        /// <summary>
        /// Initializes global exception handlers. Must be called before app.Run().
        /// </summary>
        public static void Initialize()
        {
            if (_initialized) return;

            try
            {
                Directory.CreateDirectory(_logPath);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Warning: Could not create global exception log directory at {_logPath}: {ex.Message}");
            }

            // Handle unhandled exceptions on any thread
            AppDomain.CurrentDomain.UnhandledException += OnUnhandledException;

            // Handle unhandled exceptions from Task-based async operations
            TaskScheduler.UnobservedTaskException += OnUnobservedTaskException;

            _initialized = true;
            Debug.WriteLine("Global exception handlers initialized");
        }

        private static void OnUnhandledException(object sender, UnhandledExceptionEventArgs e)
        {
            if (e.ExceptionObject is Exception ex)
            {
                var logEntry = BuildLogEntry(ex, "AppDomain.UnhandledException", e.IsTerminating);
                WriteToFile("GlobalExceptions", logEntry);
                
                // Write to console for immediate visibility
                Console.Error.WriteLine("FATAL UNHANDLED EXCEPTION:");
                Console.Error.WriteLine(logEntry);
            }
        }

        private static void OnUnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
        {
            var logEntry = BuildLogEntry(e.Exception, "TaskScheduler.UnobservedTaskException", false);
            WriteToFile("GlobalExceptions", logEntry);
            
            Console.Error.WriteLine("UNOBSERVED TASK EXCEPTION:");
            Console.Error.WriteLine(logEntry);
            
            // Mark as observed to prevent app termination
            e.SetObserved();
        }

        private static void WriteToFile(string filePrefix, string logEntry)
        {
            try
            {
                var logFileName = $"{filePrefix}-{DateTime.Now:yyyy-MM-dd}.log";
                var logFilePath = Path.Combine(_logPath, logFileName);

                lock (_fileLock)
                {
                    File.AppendAllText(logFilePath, logEntry);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to write global exception log: {ex.Message}");
            }
        }

        private static string BuildLogEntry(Exception ex, string source, bool isTerminating)
        {
            var sb = new StringBuilder();
            sb.AppendLine("=".PadRight(80, '='));
            sb.AppendLine($"Timestamp: {DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}");
            sb.AppendLine($"Source: {source}");
            sb.AppendLine($"Is Terminating: {isTerminating}");
            sb.AppendLine($"Exception Type: {ex.GetType().FullName}");
            sb.AppendLine($"Message: {ex.Message}");
            sb.AppendLine($"Stack Trace:");
            sb.AppendLine(ex.StackTrace ?? "(no stack trace)");
            
            // Recursively log inner exceptions
            var innerEx = ex.InnerException;
            int depth = 1;
            while (innerEx != null)
            {
                sb.AppendLine();
                sb.AppendLine($"Inner Exception (depth {depth}):");
                sb.AppendLine($"  Type: {innerEx.GetType().FullName}");
                sb.AppendLine($"  Message: {innerEx.Message}");
                sb.AppendLine($"  Stack Trace: {innerEx.StackTrace ?? "(no stack trace)"}");
                innerEx = innerEx.InnerException;
                depth++;
            }

            // Log aggregate exceptions
            if (ex is AggregateException aggEx)
            {
                sb.AppendLine();
                sb.AppendLine($"Aggregate Exception with {aggEx.InnerExceptions.Count} inner exceptions:");
                for (int i = 0; i < aggEx.InnerExceptions.Count; i++)
                {
                    var innerAggEx = aggEx.InnerExceptions[i];
                    sb.AppendLine($"  [{i}] {innerAggEx.GetType().FullName}: {innerAggEx.Message}");
                }
            }
            
            sb.AppendLine("=".PadRight(80, '='));
            sb.AppendLine();
            
            return sb.ToString();
        }
    }
}
