using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.Update;

/// <summary>What <see cref="IInstallInspector"/> found out about this trom's install.</summary>
/// <param name="CliFolder">The folder the running trom is in.</param>
/// <param name="Root">The release root, the folder that holds <c>api/</c> and the CLI folder; null for a source build or an unknown install.</param>
/// <param name="BrewPrefix">Homebrew's prefix, for example <c>/opt/homebrew</c>; set only for a Homebrew install.</param>
internal sealed record InstallInfo(InstallKind Kind, string CliFolder, string? Root, string? BrewPrefix);

/// <summary>Says how this trom was installed.</summary>
internal interface IInstallInspector
{
    InstallInfo Inspect();
}

/// <summary>
/// Classifies the install from what the engine locator found, so the layout is decided in one place: a source tree is a
/// source build, a packaged engine is a release unpacked anywhere or, under a Homebrew <c>Cellar</c>, a Homebrew install.
/// </summary>
/// <param name="cliFolder">The folder the running trom is in, <see cref="AppContext.BaseDirectory"/> in the real CLI.</param>
internal sealed class InstallInspector(IEngineLocator locator, string cliFolder) : IInstallInspector
{
    private const string Cellar = "/Cellar/";

    public InstallInfo Inspect() => Classify(locator.Locate().Location, cliFolder, OperatingSystem.IsWindows());

    /// <param name="engine">What the engine locator found; null when it found no engine at all.</param>
    internal static InstallInfo Classify(EngineLocation? engine, string cliFolder, bool windows)
    {
        var folder = Path.TrimEndingDirectorySeparator(cliFolder);

        switch (engine?.Mode)
        {
            case EngineMode.Source:
                return new InstallInfo(InstallKind.Source, folder, null, null);

            case EngineMode.Packaged:
                var root = Path.GetDirectoryName(folder);

                if (root is null) return new InstallInfo(InstallKind.Unknown, folder, null, null);

                var cellar = windows ? -1 : folder.Replace('\\', '/').IndexOf(Cellar, StringComparison.Ordinal);

                return cellar < 0
                    ? new InstallInfo(InstallKind.Release, folder, root, null)
                    : new InstallInfo(InstallKind.Homebrew, folder, root, cellar == 0 ? "/" : folder[..cellar]);

            default:
                return new InstallInfo(InstallKind.Unknown, folder, null, null);
        }
    }
}
