using Spectre.Console.Cli;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;

namespace TeensyRom.Cli.Commands.Engine;

internal sealed class EngineStopSettings : TromSettings;

/// <summary>The JSON result of <c>trom engine stop</c>: <c>{ "outcome": "stopped|notRunning|notSupported|foreign|failed" }</c>.</summary>
internal sealed record EngineStopDocument(EngineStopOutcome Outcome);

/// <summary>
/// <c>trom engine stop</c>: stops the TeensyROM engine, and with it the web app it serves. Needs no engine, and
/// succeeds when none is running.
/// </summary>
internal sealed class EngineStopCommand(ICliOutput output, IEngineControl engine) : TromCommand<EngineStopSettings>(output)
{
    protected override async Task<int> RunAsync(CommandContext context, EngineStopSettings settings, CancellationToken ct)
    {
        var outcome = await engine.StopAsync(ct);

        if (Output.Mode == OutputMode.Json) Output.Json(new EngineStopDocument(outcome));

        switch (outcome)
        {
            case EngineStopOutcome.Stopped:
                Output.Notice("TeensyROM engine stopped. The web app it served has stopped too.");
                return 0;
            case EngineStopOutcome.NotRunning:
                Output.Notice("No TeensyROM engine is running.");
                return 0;
            case EngineStopOutcome.NotSupported:
                throw new CliException(CliExitCode.Failed, "The running TeensyROM engine can't be stopped from the CLI — stop it where it was started.");
            case EngineStopOutcome.Foreign:
                throw new CliException(CliExitCode.Failed, $"Something other than a TeensyROM engine is using port {EngineAddress.Port} — free the port and try again.");
            default:
                throw new CliException(CliExitCode.Failed,
                    $"The TeensyROM engine didn't stop within {EngineControl.StopTimeout.TotalSeconds:0} seconds. Its logs are in {TeensyRomHome.EngineLogsPath}.");
        }
    }
}
