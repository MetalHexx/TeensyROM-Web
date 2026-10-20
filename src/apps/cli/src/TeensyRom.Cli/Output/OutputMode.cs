namespace TeensyRom.Cli.Output;

/// <summary>How a command renders its data.</summary>
internal enum OutputMode
{
    /// <summary>Stdout is a terminal: tables and colour.</summary>
    Human,

    /// <summary>Stdout is redirected: plain lines, no tables, no borders.</summary>
    Plain,

    /// <summary><c>--json</c>: one JSON document on stdout.</summary>
    Json
}
