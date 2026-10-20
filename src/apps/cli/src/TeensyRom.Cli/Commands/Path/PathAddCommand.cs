using Spectre.Console.Cli;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.PathSetup;

namespace TeensyRom.Cli.Commands.PathCommands;

/// <summary>
/// <c>trom path add</c>: puts the folder holding <c>trom</c> on the user's PATH. Repeating it changes nothing. Never
/// starts the engine and never needs administrator rights.
/// </summary>
internal sealed class PathAddCommand(ICliOutput output, PathRegistrar registrar) : TromCommand<TromSettings>(output)
{
    protected override Task<int> RunAsync(CommandContext context, TromSettings settings, CancellationToken ct)
    {
        var change = registrar.Add();
        var where = string.Join(", ", change.Locations);

        PathCommandOutput.Write(Output, change, change.Changed
            ? $"Added {change.Folder} to {where}. New terminals will see it."
            : $"{change.Folder} is already on your PATH through {where}.");

        return Task.FromResult(0);
    }
}
