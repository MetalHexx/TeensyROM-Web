using Spectre.Console.Cli;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;

namespace TeensyRom.Cli.Commands.Engine;

internal sealed class EngineStatusSettings : TromSettings;

/// <summary>
/// <c>trom engine status</c>: says whether a TeensyROM engine answers and whether its version matches this CLI's.
/// Looks only; it never starts, restarts or stops anything. Exits 3 when no engine answers.
/// </summary>
internal sealed class EngineStatusCommand(ICliOutput output, IEngineControl engine) : TromCommand<EngineStatusSettings>(output)
{
    protected override async Task<int> RunAsync(CommandContext context, EngineStatusSettings settings, CancellationToken ct)
    {
        var status = await engine.GetStatusAsync(ct);

        if (Output.Mode == OutputMode.Json) Output.Json(status);
        else Output.Fields(Describe(status));

        if (!status.Running) throw new CliException(CliExitCode.EngineUnavailable, status.Problem ?? "No TeensyROM engine is running.");

        if (!status.Matches)
        {
            Output.Notice($"The running engine is version {status.Version} but this CLI is {status.CliVersion} — the next command that needs the engine restarts it.");
        }
        return 0;
    }

    private static IReadOnlyList<(string Label, string Value)> Describe(EngineStatus status) =>
        status.Running
            ?
            [
                ("Status", "running"),
                ("Address", status.Address),
                ("Engine version", status.Version ?? string.Empty),
                ("CLI version", status.CliVersion),
                ("Version match", status.Matches ? "yes" : "no")
            ]
            :
            [
                ("Status", "not running"),
                ("Address", status.Address),
                ("CLI version", status.CliVersion)
            ];
}
