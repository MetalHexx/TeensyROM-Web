using Spectre.Console;
using Spectre.Console.Cli;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;

namespace TeensyRom.Cli.Services;

/// <summary>
/// Runs one <c>trom</c> command line and turns its outcome into an exit code. <c>Program</c> and the integration
/// harness both drive commands through it, so both get the same pre-parse steps.
/// </summary>
/// <param name="app">The public app.</param>
/// <param name="errHelpApp">An app over the same tree whose help goes to stderr, for the nearest help of a usage error.</param>
/// <param name="nouns">The nouns of the public tree, each with the names of its verbs.</param>
/// <param name="commands">The names of the top-level commands; kept apart from <paramref name="nouns"/> so they are never taken for a bare noun.</param>
internal sealed class CliSession(CommandApp app, CommandApp errHelpApp, ICliOutput output, CliConsoles consoles, IReadOnlyDictionary<string, string[]> nouns, IReadOnlyCollection<string>? commands = null)
{
    /// <summary>
    /// Runs <paramref name="args"/> once and returns the exit code. In order: reads <c>--json</c> from the raw
    /// arguments (a parse error throws before settings bind and still owes a JSON error), swaps a bare <c>-</c> for
    /// the stdin marker, rejects a bare noun, points the static console at stderr so every incidental write lands
    /// there, then runs the app.
    /// </summary>
    public async Task<int> RunAsync(string[] args)
    {
        output.UseJson(CommandRouting.WantsJson(args));

        var parseable = CommandRouting.ReplaceStdinMarker(args);
        AnsiConsole.Console = consoles.Err;

        try
        {
            if (CommandRouting.FindBareNoun(parseable, nouns) is { } noun)
            {
                throw new CliException(CliExitCode.Usage, $"`trom {noun}` needs a command — see `trom {noun} --help`.");
            }
            return await app.RunAsync(parseable);
        }
        catch (Exception ex)
        {
            return Report(ex, args);
        }
    }

    private int Report(Exception ex, string[] args)
    {
        var prefix = CommandRouting.HelpPrefix(args, nouns, commands);
        var error = ExitCodeMapper.Map(ex, $"trom {string.Join(' ', prefix.Append("--help"))}");

        if (error.Code == CliExitCode.Usage) errHelpApp.Run([.. prefix, "--help"]);

        output.Error(error);

        return (int)error.Code;
    }
}
