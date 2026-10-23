using Spectre.Console;
using Spectre.Console.Rendering;
using System.Text.Json;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Helpers;

namespace TeensyRom.Cli.Output;

/// <summary>
/// The <see cref="ICliOutput"/> over a pair of consoles.
/// </summary>
/// <remarks>
/// Data (<see cref="Json{T}"/>, <see cref="Lines"/>) and any text headed for a stream that isn't a terminal is written
/// to the console's raw writer, so Spectre never wraps it at its fallback width of 80 columns. While the menu runs
/// there is one screen: notices and errors then go to stdout like everything else.
/// </remarks>
internal sealed class CliOutput(CliConsoles consoles) : ICliOutput
{
    private const string ErrorStyle = "#cc666c";

    private bool _json;

    public OutputMode Mode => _json ? OutputMode.Json : consoles.OutIsTerminal ? OutputMode.Human : OutputMode.Plain;

    public CliRunMode RunMode { get; private set; } = CliRunMode.OneShot;

    public IAnsiConsole Out => consoles.Out;

    public IAnsiConsole Err => consoles.Err;

    public bool CanPrompt => consoles.InIsTerminal && consoles.OutIsTerminal && consoles.ErrIsTerminal;

    public bool ErrIsTerminal => consoles.ErrIsTerminal;

    public void SetRunMode(CliRunMode mode) => RunMode = mode;

    public void UseJson(bool json) => _json = json;

    public void Json<T>(T model) => WriteRaw(Out, JsonSerializer.Serialize(model, CliJson.Indented));

    public void Lines(IEnumerable<string> lines)
    {
        foreach (var line in lines) WriteRaw(Out, line);
    }

    public void Fields(IReadOnlyList<(string Label, string Value)> fields)
    {
        if (Mode == OutputMode.Plain)
        {
            Lines(fields.Select(field => $"{field.Label}: {field.Value}"));
            return;
        }

        var table = new Table().Border(TableBorder.Rounded).HideHeaders();
        table.AddColumn(new TableColumn(string.Empty));
        table.AddColumn(new TableColumn(string.Empty));

        foreach (var (label, value) in fields)
        {
            IRenderable cell = Mode == OutputMode.Human && TerminalText.IsWebLink(value) ? TerminalText.Link(null, value) : new Text(value);
            table.AddRow(new Text(label), cell);
        }

        Out.Write(table);
    }

    public void Notice(string message)
    {
        var (console, isTerminal) = Messages;

        if (isTerminal) console.MarkupLine(message.EscapeBrackets().AddHighlights());
        else WriteRaw(console, message);
    }

    public void Notice(CliNotice notice)
    {
        Notice(notice.Message);

        if (_json) WriteRaw(consoles.Err, JsonSerializer.Serialize(new CliNoticeDocument(notice), CliJson.Compact));
    }

    public void Error(CliException error)
    {
        var (console, isTerminal) = Messages;

        if (isTerminal) console.MarkupLine($"[{ErrorStyle}]{error.Message.EscapeBrackets()}[/]");
        else WriteRaw(console, error.Message);

        if (_json) WriteRaw(consoles.Err, JsonSerializer.Serialize(new CliErrorDocument(error), CliJson.Compact));
    }

    private (IAnsiConsole Console, bool IsTerminal) Messages =>
        RunMode == CliRunMode.Tui ? (consoles.Out, consoles.OutIsTerminal) : (consoles.Err, consoles.ErrIsTerminal);

    private static void WriteRaw(IAnsiConsole console, string text) => console.Profile.Out.Writer.WriteLine(text);
}

/// <summary>The JSON error object written to stderr under <c>--json</c>: <c>{ "error": { "code", "exitCode", "message" } }</c>.</summary>
internal sealed record CliErrorDocument(CliErrorBody Error)
{
    public CliErrorDocument(CliException error) : this(new CliErrorBody(error.Code, (int)error.Code, error.Message, error.Details)) { }
}

internal sealed record CliErrorBody(CliExitCode Code, int ExitCode, string Message, ErrorDetails? Details = null);

/// <summary>The JSON notice object written to stderr under <c>--json</c>: <c>{ "notice": { "code", "message", "device", "deviceId", "storage", "fix" } }</c>.</summary>
internal sealed record CliNoticeDocument(CliNotice Notice);
