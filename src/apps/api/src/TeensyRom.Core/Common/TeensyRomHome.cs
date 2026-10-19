namespace TeensyRom.Core.Common
{
    /// <summary>
    /// Resolves the per-user TeensyROM home: the one folder every TeensyROM process agrees on for state.
    /// The engine writes under <see cref="ApiPath"/>; the CLI mirrors this rule exactly to find the engine's logs and lock.
    /// </summary>
    public static class TeensyRomHome
    {
        public const string DataDirVariable = "TEENSYROM_DATA_DIR";
        public const string HomeFolderName = ".teensyrom";
        public const string ApiFolderName = "api";
        public const string CliFolderName = "cli";
        public const string EngineLockFileName = "engine.lock";

        /// <summary>Lives in <c>&lt;api&gt;/Assets</c>; holds the engine version the assets were last copied for.</summary>
        public const string PackageVersionFileName = ".package-version";

        /// <summary>
        /// The home rule: a non-blank <paramref name="dataDir"/> made absolute, else <c>&lt;userProfile&gt;/.teensyrom</c>.
        /// </summary>
        public static string Resolve(string? dataDir, string userProfile) =>
            string.IsNullOrWhiteSpace(dataDir)
                ? Path.Combine(userProfile, HomeFolderName)
                : Path.GetFullPath(dataDir);

        /// <summary>
        /// The home root. Reads the environment on every access so a variable set at runtime is honored.
        /// </summary>
        public static string Root => Resolve(
            Environment.GetEnvironmentVariable(DataDirVariable),
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile));

        /// <summary>Everything the engine writes lives under this folder.</summary>
        public static string ApiPath => Path.Combine(Root, ApiFolderName);

        /// <summary>The single-instance lock file; a running engine holds it open.</summary>
        public static string EngineLockPath => Path.Combine(ApiPath, EngineLockFileName);
    }
}
