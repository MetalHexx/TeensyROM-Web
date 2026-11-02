using NSubstitute;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

/// <summary>How an install is classified from what the engine locator found.</summary>
public sealed class InstallInspectorTests
{
    private static string Join(params string[] parts) => string.Join(Path.DirectorySeparatorChar, parts);

    private static readonly string Cli = Join(Path.GetTempPath(), "suite", "cli");

    private static readonly EngineLocation Packaged = new(EngineMode.Packaged, Join(Path.GetTempPath(), "suite", "api"));

    private static readonly EngineLocation Source = new(EngineMode.Source, Join(Path.GetTempPath(), "repo"), "TeensyRom.Api.csproj");

    [Fact]
    public void ASourceTree_IsASourceBuild()
    {
        var info = InstallInspector.Classify(Source, Cli, windows: false);

        info.Kind.Should().Be(InstallKind.Source);
        info.Root.Should().BeNull();
        info.BrewPrefix.Should().BeNull();
    }

    [Fact]
    public void APackagedEngine_IsAReleaseRootedAboveTheCliFolder()
    {
        var info = InstallInspector.Classify(Packaged, Cli, windows: false);

        info.Kind.Should().Be(InstallKind.Release);
        info.CliFolder.Should().Be(Cli);
        info.Root.Should().Be(Path.GetDirectoryName(Cli));
        info.BrewPrefix.Should().BeNull();
    }

    [Fact]
    public void ATrailingSeparatorOnTheCliFolder_DoesNotMoveTheRoot()
    {
        var info = InstallInspector.Classify(Packaged, Cli + Path.DirectorySeparatorChar, windows: false);

        info.CliFolder.Should().Be(Cli);
        info.Root.Should().Be(Path.GetDirectoryName(Cli));
    }

    [Theory]
    [InlineData("/opt/homebrew", "/opt/homebrew/Cellar/teensyrom-suite/1.0.0/libexec/cli")]
    [InlineData("/usr/local", "/usr/local/Cellar/teensyrom-suite/1.0.0/libexec/cli/")]
    [InlineData("/home/linuxbrew/.linuxbrew", "/home/linuxbrew/.linuxbrew/Cellar/teensyrom-suite/1.0.0/libexec/cli")]
    public void APackagedEngineUnderACellar_IsHomebrewWithThePrefixBeforeIt(string prefix, string cliFolder)
    {
        var info = InstallInspector.Classify(Packaged, cliFolder, windows: false);

        info.Kind.Should().Be(InstallKind.Homebrew);
        info.BrewPrefix.Should().Be(prefix);
        info.Root.Should().NotBeNull();
    }

    [Fact]
    public void ACellarFolderOnWindows_IsStillARelease()
    {
        InstallInspector.Classify(Packaged, "C:/Cellar/suite/cli", windows: true).Kind.Should().Be(InstallKind.Release);
    }

    [Fact]
    public void AFolderThatOnlyContainsTheWordCellar_IsNotHomebrew()
    {
        InstallInspector.Classify(Packaged, "/home/me/MyCellar/suite/cli", windows: false).Kind.Should().Be(InstallKind.Release);
    }

    [Fact]
    public void NoEngineAtAll_IsAnUnknownInstall()
    {
        InstallInspector.Classify(null, Cli, windows: false).Kind.Should().Be(InstallKind.Unknown);
    }

    [Fact]
    public void Inspect_AsksTheLocatorAndClassifiesItsAnswer()
    {
        var locator = Substitute.For<IEngineLocator>();
        locator.Locate().Returns(new EngineLookup(Packaged, Packaged.Folder));

        var info = new InstallInspector(locator, Cli).Inspect();

        info.Kind.Should().Be(InstallKind.Release);
        info.Root.Should().Be(Path.GetDirectoryName(Cli));
    }
}
