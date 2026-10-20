using Spectre.Console.Cli;
using System.Diagnostics;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Common;

namespace TeensyRom.Cli.Errors;

/// <summary>
/// Turns whatever a command run threw into the <see cref="CliException"/> that decides the exit code and the
/// one sentence shown to the user.
/// </summary>
internal static class ExitCodeMapper
{
    private static readonly object LogFileLock = new();

    /// <summary>Where unexpected exceptions are written in full.</summary>
    public static string UnhandledErrorLogPath => Path.Combine(TeensyRomHome.CliLogsPath, "UnhandledErrorLogs.txt");

    /// <summary>
    /// Maps <paramref name="error"/> to its exit code and sentence.
    /// </summary>
    /// <param name="error">What the run threw.</param>
    /// <param name="helpCommand">The command a usage error points the user to, for example <c>trom device --help</c>.</param>
    /// <param name="log">Records an unexpected exception in full; defaults to <see cref="LogExceptionToFile"/>.</param>
    public static CliException Map(Exception error, string helpCommand = "trom --help", Action<Exception>? log = null)
    {
        switch (error)
        {
            case CliException known:
                return known;

            case CommandParseException or CommandRuntimeException:
                return new CliException(CliExitCode.Usage, $"{error.Message.TrimEnd('.', ' ')} — see `{helpCommand}`.");

            case TeensyApiException { StatusCode: 404 } api:
                return new CliException(CliExitCode.NotFound, api.Message);

            case TeensyApiException { StatusCode: null, InnerException: HttpRequestException } api:
                return new CliException(CliExitCode.EngineUnavailable, api.Message);

            case TeensyApiException api:
                return new CliException(CliExitCode.Failed, api.Message);

            default:
                (log ?? LogExceptionToFile)(error);
                return new CliException(CliExitCode.Failed, $"Something unexpected went wrong — the details are in {UnhandledErrorLogPath}.");
        }
    }

    /// <summary>Appends the exception, in full, to the unhandled-error log. Never throws.</summary>
    public static void LogExceptionToFile(Exception ex)
    {
        var filePath = UnhandledErrorLogPath;

        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);

            lock (LogFileLock)
            {
                File.AppendAllText(filePath, $"{DateTime.Now}{Environment.NewLine}Exception: {ex}{Environment.NewLine}{Environment.NewLine}");
            }
        }
        catch (Exception logEx)
        {
            Debug.WriteLine("Failed to log exception: " + logEx.Message);
        }
    }
}
