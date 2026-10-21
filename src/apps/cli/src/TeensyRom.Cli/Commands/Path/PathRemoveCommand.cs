using Spectre.Console.Cli;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.PathSetup;

namespace TeensyRom.Cli.Commands.PathCommands;

/// <summary>
/// <c>trom path remove</c>: takes off the PATH exactly what <c>trom path add</c> put there. Never starts the engine.
/// </summary>
internal sealed class PathRemoveCommand(ICliOutput output, PathRegistrar registrar) : TromCommand<TromSettings>(output)
{
    protected override Task<int> RunAsync(CommandContext context, TromSettings settings, CancellationToken ct)
    {
        var change = registrar.Remove();

        PathCommandOutput.Write(Output, change, change.Changed
            ? $"Removed trom from {string.Join(", ", change.Locations)}. New terminals will no longer see it."
            : "Nothing to remove: trom has not put anything on your PATH.");

        return Task.FromResult(0);
    }
}

/// <summary>How <c>add</c> and <c>remove</c> report: the JSON document, or the fields and one sentence.</summary>
internal static class PathCommandOutput
{
    public static void Write(ICliOutput output, PathChange change, string message)
    {
        if (output.Mode == OutputMode.Json)
        {
            output.Json(change);
            return;
        }

        if (output.Mode == OutputMode.Plain)
        {
            output.Fields(
            [
                ("changed", change.Changed ? "true" : "false"),
                ("folder", change.Folder),
                ("locations", string.Join(", ", change.Locations))
            ]);
        }
        output.Notice(message);
    }
}
