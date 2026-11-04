using Spectre.Console.Cli;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;

namespace TeensyRom.Cli.Commands.Engine;

internal sealed class EngineStartSettings : TromSettings;

/// <summary>
/// <c>trom api start</c>: starts Trom API when none is running, and reports what <c>trom api status</c> would. Does
/// nothing to one that already runs at this CLI's version. Exits 3 when Trom API can't be started.
/// </summary>
internal sealed class EngineStartCommand(ICliOutput output, IEngineControl engine) : EngineCommand<EngineStartSettings>(output, engine)
{
    protected override async Task<int> RunAsync(CommandContext context, EngineStartSettings settings, CancellationToken ct)
    {
        var status = await Engine.GetStatusAsync(ct);

        if (Output.Mode == OutputMode.Json) Output.Json(status);
        else Output.Fields(EngineStatusCommand.Describe(status));

        if (!status.Running) throw new CliException(CliExitCode.EngineUnavailable, status.Problem ?? "Trom API isn't running.");

        if (status.Https?.Notice is { } notice) Output.Notice(notice);

        return 0;
    }
}
