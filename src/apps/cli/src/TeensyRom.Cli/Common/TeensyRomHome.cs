namespace TeensyRom.Cli.Common;

/// <summary>
/// The per-user TeensyROM home the engine and this CLI agree on. The rule is the engine's own, duplicated here on
/// purpose because the CLI references no engine project: a non-blank <c>TEENSYROM_DATA_DIR</c> made absolute,
/// else <c>&lt;user profile&gt;/.teensyrom</c>. The engine writes under <see cref="ApiPath"/>, the CLI under <see cref="CliPath"/>.
/// </summary>
internal static class TeensyRomHome
{
    public const string DataDirVariable = "TEENSYROM_DATA_DIR";

    private const string HomeFolderName = ".teensyrom";

    /// <summary>
    /// The home rule: a non-blank <paramref name="dataDir"/> made absolute, else <c>&lt;userProfile&gt;/.teensyrom</c>.
    /// </summary>
    public static string Resolve(string? dataDir, string userProfile) =>
        string.IsNullOrWhiteSpace(dataDir)
            ? Path.Combine(userProfile, HomeFolderName)
            : Path.GetFullPath(dataDir);

    /// <summary>The home root. Reads the environment on every access so a variable set at runtime is honored.</summary>
    public static string Root => Resolve(
        Environment.GetEnvironmentVariable(DataDirVariable),
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile));

    public static string ApiPath => Path.Combine(Root, "api");

    public static string CliPath => Path.Combine(Root, "cli");

    /// <summary>The single-instance lock a running engine holds open.</summary>
    public static string EngineLockPath => Path.Combine(ApiPath, "engine.lock");

    /// <summary>Where the engine writes its logs, and its console output when this CLI starts it.</summary>
    public static string EngineLogsPath => Path.Combine(ApiPath, "Assets", "System", "Logs");

    public static string CliLogsPath => Path.Combine(CliPath, "Logs");

    public static string EngineBuildLogPath => Path.Combine(CliLogsPath, "engine-build.log");

    /// <summary>Records which engine sources the engine this CLI started in source mode was built from.</summary>
    public static string SourceEngineRecordPath => Path.Combine(CliPath, "source-engine.json");

    /// <summary>What each device last launched and how its player was set, so one <c>trom</c> run can carry on from the last.</summary>
    public static string LastLaunchPath => Path.Combine(CliPath, "last-launch.json");

    /// <summary>
    /// Pins a relative <c>TEENSYROM_DATA_DIR</c> to its absolute path in this process, so an engine started from
    /// another working directory resolves the same home and lock. Does nothing when the variable is unset.
    /// </summary>
    public static void ExportToProcess()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(DataDirVariable))) return;

        Environment.SetEnvironmentVariable(DataDirVariable, Root);
    }
}
