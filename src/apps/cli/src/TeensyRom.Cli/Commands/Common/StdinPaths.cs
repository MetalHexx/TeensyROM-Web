using TeensyRom.Cli.Errors;

namespace TeensyRom.Cli.Commands.Common;

/// <summary>
/// Stands in for a bare <c>-</c> on the command line: a path argument or option that reads its paths from a pipe.
/// </summary>
/// <remarks>
/// Spectre's tokenizer rejects a bare <c>-</c>, so the session swaps each one for <see cref="StdinPaths.Marker"/>
/// before parsing. The marker is not a valid device path, which is why a path is never validated until it has been
/// through <see cref="Expand"/> or <see cref="ExpandOne"/>.
/// </remarks>
internal interface IStdinPaths
{
    /// <summary>Replaces each marker with every path read from stdin; any other argument is kept as it is.</summary>
    /// <exception cref="CliException">A marker was given but stdin is a terminal or held no paths.</exception>
    IReadOnlyList<string> Expand(IEnumerable<string> args);

    /// <summary>Replaces the marker with the first path read from stdin; any other argument is returned as it is.</summary>
    /// <exception cref="CliException">The marker was given but stdin is a terminal or held no paths.</exception>
    string ExpandOne(string arg);
}

/// <summary>
/// Reads stdin's lines (trimmed, blanks skipped) the first time a marker needs them, and only then.
/// </summary>
internal sealed class StdinPaths(TextReader input, bool inputIsTerminal) : IStdinPaths
{
    /// <summary>Device paths start with <c>/</c>, so this cannot collide with a real argument.</summary>
    public const string Marker = ":stdin:";

    private IReadOnlyList<string>? _paths;

    public IReadOnlyList<string> Expand(IEnumerable<string> args)
    {
        var expanded = new List<string>();

        foreach (var arg in args)
        {
            if (arg == Marker) expanded.AddRange(Read());
            else expanded.Add(arg);
        }
        return expanded;
    }

    public string ExpandOne(string arg) => arg == Marker ? Read()[0] : arg;

    private IReadOnlyList<string> Read()
    {
        if (_paths is not null) return _paths;

        if (inputIsTerminal) throw NoPaths();

        var paths = input.ReadToEnd()
            .Split('\n')
            .Select(line => line.Trim())
            .Where(line => line.Length > 0)
            .ToList();

        if (paths.Count == 0) throw NoPaths();

        return _paths = paths;
    }

    private static CliException NoPaths() =>
        new(CliExitCode.Usage, "`-` reads paths from a pipe; pass a path instead.");
}
