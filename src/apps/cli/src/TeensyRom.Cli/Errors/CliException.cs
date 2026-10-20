namespace TeensyRom.Cli.Errors;

/// <summary>
/// The exit code a <c>trom</c> invocation ends with. The numbers are a stable contract for scripts.
/// </summary>
internal enum CliExitCode
{
    Success = 0,
    Failed = 1,
    Usage = 2,
    EngineUnavailable = 3,
    NoDevice = 4,
    NotFound = 5
}

/// <summary>
/// A failure whose message is already the one sentence to show the user, and whose code is the exit code to end with.
/// </summary>
internal sealed class CliException(CliExitCode code, string message) : Exception(message)
{
    public CliExitCode Code { get; } = code;
}
