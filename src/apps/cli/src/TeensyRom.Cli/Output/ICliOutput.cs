using Spectre.Console;
using TeensyRom.Cli.Errors;

namespace TeensyRom.Cli.Output;

/// <summary>
/// Where a command's results and messages go: data on stdout, everything else on stderr.
/// </summary>
/// <remarks>
/// When stdout is not a terminal no command renders a table or a border: lists go through <see cref="Lines"/> and
/// single records through <see cref="Fields"/>.
/// </remarks>
internal interface ICliOutput
{
    OutputMode Mode { get; }

    /// <summary><see cref="CliRunMode.OneShot"/> until the menu calls <see cref="SetRunMode"/>.</summary>
    CliRunMode RunMode { get; }

    void SetRunMode(CliRunMode mode);

    /// <summary>Stdout. Data only.</summary>
    IAnsiConsole Out { get; }

    /// <summary>Stderr: notices, progress, warnings, errors and the prompts of a one-shot command.</summary>
    IAnsiConsole Err { get; }

    /// <summary>Stdin, stdout and stderr are all terminals, so a prompt (rendered on stderr) can be answered.</summary>
    bool CanPrompt { get; }

    /// <summary>Switches to <see cref="OutputMode.Json"/> for the rest of this invocation, or back to the terminal/redirect default.</summary>
    void UseJson(bool json);

    /// <summary>Writes the model as one indented JSON document on stdout.</summary>
    void Json<T>(T model);

    /// <summary>Plain mode: one item per line, no markup.</summary>
    void Lines(IEnumerable<string> lines);

    /// <summary>A single record: a small table for a terminal, <c>label: value</c> lines when redirected.</summary>
    void Fields(IReadOnlyList<(string Label, string Value)> fields);

    /// <summary>A progress or status sentence on stderr.</summary>
    void Notice(string message);

    /// <summary>
    /// The notice's sentence on stderr, as <see cref="Notice(string)"/>. In JSON mode the JSON notice object follows,
    /// compact on one line, as the last thing written to stderr.
    /// </summary>
    void Notice(CliNotice notice);

    /// <summary>
    /// The error sentence on stderr. In JSON mode the JSON error object follows, compact on one line, as the last thing
    /// written to stderr.
    /// </summary>
    void Error(CliException error);
}
