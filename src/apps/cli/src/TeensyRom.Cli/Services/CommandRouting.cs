using TeensyRom.Cli.Commands.Common;

namespace TeensyRom.Cli.Services;

/// <summary>
/// Reads the raw command line before Spectre parses it: the decisions that must hold even when parsing fails.
/// Whether a command needs the engine is not decided here; its base class declares it.
/// </summary>
internal static class CommandRouting
{
    private const string EndOfOptions = "--";

    /// <summary>True when <c>--json</c> appears anywhere before an end-of-options <c>--</c>, so a parse error still gets its JSON error.</summary>
    public static bool WantsJson(string[] args) =>
        args.TakeWhile(arg => arg != EndOfOptions).Contains("--json");

    /// <summary>True when <c>-h</c> or <c>--help</c> appears anywhere.</summary>
    public static bool AsksForHelp(string[] args) => args.Any(IsHelpFlag);

    /// <summary>
    /// Swaps each standalone <c>-</c> for <see cref="StdinPaths.Marker"/>: Spectre's tokenizer throws "Option does
    /// not have a name." on a bare <c>-</c>, even after <c>--</c>.
    /// </summary>
    public static string[] ReplaceStdinMarker(string[] args) =>
        args.Select(arg => arg == "-" ? StdinPaths.Marker : arg).ToArray();

    /// <summary>
    /// The noun when the command line is a known noun with no verb: nothing after it, or only options other than help.
    /// Spectre would answer such a line with help and exit code 0; it is a usage error.
    /// </summary>
    public static string? FindBareNoun(string[] args, IReadOnlyCollection<string> nouns)
    {
        if (args.Length == 0 || !nouns.Contains(args[0], StringComparer.Ordinal)) return null;

        var rest = args.Skip(1).ToArray();

        return !AsksForHelp(rest) && rest.All(arg => arg.StartsWith('-')) ? args[0] : null;
    }

    /// <summary>The words that name the nearest help for a usage error: the noun when the line starts with one, else none (the root).</summary>
    public static string[] HelpPrefix(string[] args, IReadOnlyCollection<string> nouns) =>
        args.Length > 0 && nouns.Contains(args[0], StringComparer.Ordinal) ? [args[0]] : [];

    private static bool IsHelpFlag(string arg) => arg is "-h" or "--help";
}
