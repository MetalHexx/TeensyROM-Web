namespace TeensyRom.Cli.Engine;

/// <summary>Finds the engine this CLI starts.</summary>
internal interface IEngineLocator
{
    EngineLookup Locate();
}

/// <summary>
/// Finds the engine relative to the CLI's own location, never through PATH or a setting. A packaged CLI sits in a
/// folder beside the engine's executable; a CLI run from source sits inside a tr-web checkout whose engine it builds.
/// </summary>
/// <param name="baseDirectory">The CLI's own directory, <see cref="AppContext.BaseDirectory"/> in the real CLI.</param>
internal sealed class EngineLocator(string baseDirectory) : IEngineLocator
{
    public static string ExecutableName => OperatingSystem.IsWindows() ? "TeensyRom.Api.exe" : "TeensyRom.Api";

    private const string ApiProjectRelativePath = "apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj";

    public EngineLookup Locate()
    {
        var packagedFolder = Path.GetFullPath(Path.Combine(baseDirectory, ".."));

        if (File.Exists(Path.Combine(packagedFolder, ExecutableName)))
        {
            return new EngineLookup(new EngineLocation(EngineMode.Packaged, packagedFolder), packagedFolder);
        }

        return new EngineLookup(FindSource(), packagedFolder);
    }

    // Only a CLI that sits inside a tr-web checkout's cli app may build that checkout's engine: a packaged CLI whose
    // engine is missing must not wander up the disk and build whatever it finds.
    private EngineLocation? FindSource()
    {
        for (var dir = new DirectoryInfo(Path.GetFullPath(baseDirectory)); dir is not null; dir = dir.Parent)
        {
            if (!IsNamed(dir, "cli") || !IsNamed(dir.Parent, "apps") || !IsNamed(dir.Parent?.Parent, "src")) continue;

            var src = dir.Parent!.Parent!;
            var project = Path.GetFullPath(Path.Combine(src.FullName, ApiProjectRelativePath));

            return File.Exists(project) && src.Parent is { } root
                ? new EngineLocation(EngineMode.Source, root.FullName, project)
                : null;
        }
        return null;
    }

    private static bool IsNamed(DirectoryInfo? dir, string name) =>
        dir is not null && string.Equals(dir.Name, name, StringComparison.OrdinalIgnoreCase);
}
