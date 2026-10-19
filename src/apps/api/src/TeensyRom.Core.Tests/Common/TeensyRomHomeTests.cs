using TeensyRom.Core.Common;

namespace TeensyRom.Core.Tests.Common;

/// <summary>
/// The home rule is tested through the pure <see cref="TeensyRomHome.Resolve"/>; mutating the environment here would
/// race other test classes that resolve paths from it.
/// </summary>
public class TeensyRomHomeTests
{
    private static readonly string UserProfile = Path.Combine(Path.GetTempPath(), "profile");

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Resolve_WithoutADataDir_UsesTheDotFolderInTheUserProfile(string? dataDir)
    {
        TeensyRomHome.Resolve(dataDir, UserProfile).Should().Be(Path.Combine(UserProfile, ".teensyrom"));
    }

    [Fact]
    public void Resolve_WithAnAbsoluteDataDir_UsesItAsTheRoot()
    {
        var dataDir = Path.Combine(Path.GetTempPath(), "custom-home");

        TeensyRomHome.Resolve(dataDir, UserProfile).Should().Be(Path.GetFullPath(dataDir));
    }

    [Fact]
    public void Resolve_WithARelativeDataDir_MakesItAbsoluteAgainstTheCurrentDirectory()
    {
        var resolved = TeensyRomHome.Resolve(Path.Combine("relative", "home"), UserProfile);

        Path.IsPathRooted(resolved).Should().BeTrue();
        resolved.Should().Be(Path.Combine(Directory.GetCurrentDirectory(), "relative", "home"));
    }

    [Fact]
    public void ApiPathAndEngineLockPath_AreComposedUnderTheRoot()
    {
        TeensyRomHome.ApiPath.Should().Be(Path.Combine(TeensyRomHome.Root, "api"));
        TeensyRomHome.EngineLockPath.Should().Be(Path.Combine(TeensyRomHome.ApiPath, "engine.lock"));
    }

    [Fact]
    public void GetDataPath_IsTheApiPath()
    {
        typeof(TeensyRomHome).Assembly.GetDataPath().Should().Be(TeensyRomHome.ApiPath);
    }
}
