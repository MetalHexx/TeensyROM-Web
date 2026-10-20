using Spectre.Console.Cli;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.PathSetup;

namespace TeensyRom.Cli.Commands.PathCommands;

/// <summary>
/// <c>trom path status</c>: whether <c>trom</c> resolves now, and each PATH entry <c>trom</c> manages, with where it
/// lives and whether it is stale (its folder no longer holds <c>trom</c>). Reads only; never starts the engine.
/// </summary>
internal sealed class PathStatusCommand(ICliOutput output, PathRegistrar registrar) : TromCommand<TromSettings>(output)
{
    protected override Task<int> RunAsync(CommandContext context, TromSettings settings, CancellationToken ct)
    {
        var status = registrar.Status();

        if (Output.Mode == OutputMode.Json) Output.Json(status);
        else Output.Fields(Fields(status));

        return Task.FromResult(0);
    }

    private static IReadOnlyList<(string Label, string Value)> Fields(PathStatus status) =>
    [
        ("onPath", status.OnPath ? "true" : "false"),
        .. status.Entries.Select(entry => ("entry", $"{entry.Folder} in {entry.Location}{(entry.Stale ? " (stale)" : string.Empty)}"))
    ];
}
