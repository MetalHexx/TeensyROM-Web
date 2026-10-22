namespace TeensyRom.Cli.Engine;

/// <summary>
/// The build configuration of an engine built from source. It is Release, which is what a user who installs from
/// source should run; a developer gets Debug by setting <see cref="VariableName"/> to <c>Debug</c>.
/// </summary>
internal static class EngineConfiguration
{
    public const string VariableName = "TROM_ENGINE_CONFIGURATION";

    public const string Release = "Release";
    public const string Debug = "Debug";

    /// <summary>Debug when the variable says so (any casing); Release for everything else, including a value that isn't a configuration.</summary>
    public static string Current => From(Environment.GetEnvironmentVariable(VariableName));

    internal static string From(string? value) =>
        string.Equals(value?.Trim(), Debug, StringComparison.OrdinalIgnoreCase) ? Debug : Release;
}
