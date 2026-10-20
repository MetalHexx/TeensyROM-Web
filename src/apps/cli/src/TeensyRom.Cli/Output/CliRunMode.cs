namespace TeensyRom.Cli.Output;

/// <summary>Whether this process runs one command and exits, or the interactive menu.</summary>
internal enum CliRunMode
{
    OneShot,
    Tui
}
