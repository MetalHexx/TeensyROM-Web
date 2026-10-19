using TeensyRom.Cli.Common;
using TeensyRom.Cli.Logging;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Tests;

public class TeensyRomHomeTests
{
    private static readonly string Profile = Path.Combine(Path.GetTempPath(), "profile");

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Resolve_WithoutAnOverride_UsesTheDotFolderInTheUserProfile(string? dataDir)
    {
        TeensyRomHome.Resolve(dataDir, Profile).Should().Be(Path.Combine(Profile, ".teensyrom"));
    }

    [Fact]
    public void Resolve_WithAnAbsoluteOverride_UsesItAsIs()
    {
        var folder = Path.Combine(Path.GetTempPath(), "somewhere", "home");

        TeensyRomHome.Resolve(folder, Profile).Should().Be(folder);
    }

    [Fact]
    public void Resolve_WithARelativeOverride_MakesItAbsolute()
    {
        var resolved = TeensyRomHome.Resolve(Path.Combine("relative", "home"), Profile);

        Path.IsPathRooted(resolved).Should().BeTrue();
        resolved.Should().Be(Path.GetFullPath(Path.Combine("relative", "home")));
    }

    [Fact]
    public void TheCliAndEnginePaths_SitUnderTheOneRoot()
    {
        var root = TeensyRomHome.Root;

        TeensyRomHome.ApiPath.Should().Be(Path.Combine(root, "api"));
        TeensyRomHome.CliPath.Should().Be(Path.Combine(root, "cli"));
        TeensyRomHome.EngineLockPath.Should().Be(Path.Combine(root, "api", "engine.lock"));
        TeensyRomHome.EngineLogsPath.Should().Be(Path.Combine(root, "api", "Assets", "System", "Logs"));
    }

    [Fact]
    public void TheCliSettingsAndLogs_LiveInTheCliFolder()
    {
        SettingsConstants.SettingsPath.Should().Be(Path.Combine(TeensyRomHome.CliPath, "Settings.json"));
        LogConstants.LogPath.Should().Be(Path.Combine(TeensyRomHome.CliPath, "Logs", "Logs.txt"));
    }
}
