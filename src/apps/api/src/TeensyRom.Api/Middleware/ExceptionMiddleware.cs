using System.Diagnostics;
using System.Reflection;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using TeensyRom.Core.Common;

namespace TeensyRom.Api.Middleware
{
    /// <summary>
    /// Middleware to catch and log unhandled exceptions during HTTP request processing.
    /// Logs to disk with rolling date-based files.
    /// </summary>
    public class ExceptionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly string _logPath;
        private static readonly object _fileLock = new();

        public ExceptionMiddleware(RequestDelegate next)
        {
            _next = next;
            _logPath = Path.Combine(Assembly.GetExecutingAssembly().GetDataPath(), "Assets", "System", "Logs");
            
            try
            {
                Directory.CreateDirectory(_logPath);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Warning: Could not create exception log directory at {_logPath}: {ex.Message}");
            }
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                await LogExceptionAsync(ex, context);
                await HandleExceptionResponseAsync(context, ex);
            }
        }

        private async Task LogExceptionAsync(Exception ex, HttpContext context)
        {
            var logEntry = BuildLogEntry(ex, context);
            
            try
            {
                var logFileName = $"MiddlewareExceptions-{DateTime.Now:yyyy-MM-dd}.log";
                var logFilePath = Path.Combine(_logPath, logFileName);

                // Write to file with lock to prevent concurrent writes
                lock (_fileLock)
                {
                    File.AppendAllText(logFilePath, logEntry);
                }

                // Also write to Debug output
                Debug.WriteLine($"MIDDLEWARE EXCEPTION: {ex.Message}");
            }
            catch (Exception logEx)
            {
                Debug.WriteLine($"Failed to log middleware exception: {logEx.Message}");
            }

            await Task.CompletedTask;
        }

        private static async Task HandleExceptionResponseAsync(HttpContext context, Exception ex)
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/problem+json";

            var problemDetails = new ProblemDetails
            {
                Type = "https://tools.ietf.org/html/rfc7231#section-6.6.1",
                Title = "An error occurred while processing your request.",
                Status = StatusCodes.Status500InternalServerError,
                Detail = ex.Message,
                Instance = context.Request.Path
            };

            await JsonSerializer.SerializeAsync(context.Response.Body, problemDetails);
        }

        private static string BuildLogEntry(Exception ex, HttpContext context)
        {
            var sb = new StringBuilder();
            sb.AppendLine("=".PadRight(80, '='));
            sb.AppendLine($"Timestamp: {DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}");
            sb.AppendLine($"Request: {context.Request.Method} {context.Request.Path}{context.Request.QueryString}");
            sb.AppendLine($"Exception Type: {ex.GetType().FullName}");
            sb.AppendLine($"Message: {ex.Message}");
            sb.AppendLine($"Stack Trace:");
            sb.AppendLine(ex.StackTrace ?? "(no stack trace)");
            
            if (ex.InnerException != null)
            {
                sb.AppendLine();
                sb.AppendLine("Inner Exception:");
                sb.AppendLine($"  Type: {ex.InnerException.GetType().FullName}");
                sb.AppendLine($"  Message: {ex.InnerException.Message}");
                sb.AppendLine($"  Stack Trace: {ex.InnerException.StackTrace ?? "(no stack trace)"}");
            }
            
            sb.AppendLine("=".PadRight(80, '='));
            sb.AppendLine();
            
            return sb.ToString();
        }
    }
}
