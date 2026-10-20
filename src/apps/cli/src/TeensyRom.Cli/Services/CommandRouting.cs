namespace TeensyRom.Cli.Services;

/// <summary>
/// Decides from a command line whether the command needs the engine, so those that don't (help, version, credits,
/// the ASID patch generator, stopping the engine) run without starting one.
/// </summary>
internal static class CommandRouting
{
    private static readonly string[] EngineFreeCommands = ["chipsynth", "cs", "credits", "c", "stop"];

    /// <summary>True for a command line that asks for help or the version.</summary>
    public static bool IsHelpOrVersion(string[] args) =>
        args.Contains("-h") || args.Contains("--help") || args.Contains("-v") || args.Contains("--version");

    /// <summary>
    /// False for no arguments (the menu alone needs nothing), for help or version, and for the engine-free commands;
    /// true for everything else.
    /// </summary>
    public static bool NeedsEngine(string[] args) =>
        args.Length > 0
        && !IsHelpOrVersion(args)
        && !EngineFreeCommands.Contains(args[0], StringComparer.OrdinalIgnoreCase);

    /// <summary>True when the command line runs <c>stop</c>.</summary>
    public static bool IsStop(string[] args) =>
        args.Length > 0 && string.Equals(args[0], "stop", StringComparison.OrdinalIgnoreCase);
}
