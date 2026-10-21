using Spectre.Console;

namespace TeensyRom.Cli.Output;

/// <summary>
/// The two consoles a <c>trom</c> invocation writes to: <see cref="Out"/> carries command data and nothing else,
/// <see cref="Err"/> everything incidental.
/// </summary>
/// <param name="OutIsTerminal">Stdout is a terminal rather than a pipe or a file.</param>
/// <param name="ErrIsTerminal">Stderr is a terminal rather than a pipe or a file.</param>
/// <param name="InIsTerminal">Stdin is a terminal rather than a pipe or a file.</param>
internal sealed record CliConsoles(IAnsiConsole Out, IAnsiConsole Err, bool OutIsTerminal, bool ErrIsTerminal, bool InIsTerminal)
{
    /// <summary>The real stdout and stderr, tuned to whether each is redirected and to <c>NO_COLOR</c>.</summary>
    public static CliConsoles Create()
    {
        var noColor = Environment.GetEnvironmentVariable("NO_COLOR") is { Length: > 0 };

        return new CliConsoles(
            AnsiConsole.Create(SettingsFor(Console.Out, Console.IsOutputRedirected, noColor)),
            AnsiConsole.Create(SettingsFor(Console.Error, Console.IsErrorRedirected, noColor)),
            OutIsTerminal: !Console.IsOutputRedirected,
            ErrIsTerminal: !Console.IsErrorRedirected,
            InIsTerminal: !Console.IsInputRedirected);
    }

    /// <summary>
    /// A redirected stream gets neither ANSI nor colour. <c>NO_COLOR</c> drops colour only: ANSI stays on, because
    /// without it every selection prompt throws, which would break the menu, the device prompt and the player.
    /// </summary>
    internal static AnsiConsoleSettings SettingsFor(TextWriter writer, bool redirected, bool noColor)
    {
        var settings = new AnsiConsoleSettings { Out = new AnsiConsoleOutput(writer) };

        if (redirected)
        {
            settings.Ansi = AnsiSupport.No;
            settings.ColorSystem = ColorSystemSupport.NoColors;
        }
        else if (noColor)
        {
            settings.ColorSystem = ColorSystemSupport.NoColors;
        }
        return settings;
    }
}
