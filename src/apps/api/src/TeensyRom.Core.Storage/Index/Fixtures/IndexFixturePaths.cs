namespace TeensyRom.Core.Storage.Index.Fixtures
{
    /// <summary>
    /// Resolves the local, git-ignored directory that holds extracted index fixtures. The fixture is a
    /// listing of a personal collection and must never be committed.
    /// </summary>
    public static class IndexFixturePaths
    {
        private const string FixtureDirEnvironmentVariable = "TEENSYROM_FIXTURE_DIR";

        public static string ResolveDirectory()
        {
            var overridePath = Environment.GetEnvironmentVariable(FixtureDirEnvironmentVariable);

            return !string.IsNullOrWhiteSpace(overridePath)
                ? overridePath
                : Path.Combine(FindRepositoryRoot(), "src", "apps", "api", ".local-fixtures");
        }

        private static string FindRepositoryRoot()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);

            while (directory is not null)
            {
                if (File.Exists(Path.Combine(directory.FullName, "src", "apps", "api", "TeensyRom.Ui.sln")))
                {
                    return directory.FullName;
                }

                directory = directory.Parent;
            }

            throw new DirectoryNotFoundException(
                $"Could not locate the repository root above '{AppContext.BaseDirectory}'.");
        }
    }
}
