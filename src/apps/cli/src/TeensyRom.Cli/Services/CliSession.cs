using Spectre.Console.Cli;

namespace TeensyRom.Cli.Services;

/// <summary>
/// Runs commands for one CLI session, getting the engine ready first for those that need it. <c>Program</c> and the
/// integration harness both drive commands through it.
/// </summary>
internal sealed class CliSession(CommandApp app, StartupGate gate)
{
    /// <summary>
    /// True when <paramref name="args"/> needs no engine, or the engine and device are ready; false after the
    /// gate told the user what to fix.
    /// </summary>
    public async Task<bool> EnsureReadyForAsync(string[] args) =>
        !CommandRouting.NeedsEngine(args) || await gate.EnsureReadyAsync();

    /// <summary>
    /// Runs one command and returns its exit code, or 1 without running it when the engine isn't ready.
    /// After <c>stop</c> the next engine command checks the engine again.
    /// </summary>
    public async Task<int> RunCommandAsync(string[] args)
    {
        if (!await EnsureReadyForAsync(args)) return 1;

        var exitCode = await app.RunAsync(args);

        if (CommandRouting.IsStop(args)) gate.Reset();

        return exitCode;
    }
}
