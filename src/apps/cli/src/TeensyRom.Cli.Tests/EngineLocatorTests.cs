using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.Tests;

public sealed class EngineLocatorTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), $"teensyrom-locator-{Guid.NewGuid():N}");

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    private string Folder(params string[] parts)
    {
        var path = Path.Combine([_root, .. parts]);
        Directory.CreateDirectory(path);
        return path;
    }

    private static void Touch(string folder, string file) => File.WriteAllText(Path.Combine(folder, file), "");

    private string ApiProject(string repo)
    {
        var folder = Folder(repo, "src", "apps", "api", "src", "TeensyRom.Api");
        Touch(folder, "TeensyRom.Api.csproj");
        return Path.Combine(folder, "TeensyRom.Api.csproj");
    }

    [Fact]
    public void Locate_WithTheEngineInTheApiFolderBesideTheCliFolder_FindsThePackagedEngine()
    {
        var api = Folder("install", "api");
        Touch(api, EngineLocator.ExecutableName);

        var found = new EngineLocator(Folder("install", "cli")).Locate();

        found.Location.Should().Be(new EngineLocation(EngineMode.Packaged, api));
    }

    [Fact]
    public void Locate_WithTheEngineBesideTheCliInsteadOfInApi_DoesNotTreatItAsPackaged()
    {
        var install = Folder("install");
        Touch(install, EngineLocator.ExecutableName);

        new EngineLocator(Folder("install", "cli")).Locate().Location.Should().BeNull();
    }

    [Fact]
    public void Locate_FromInsideThePackagedCliFolderWithATrailingSeparator_StillFindsIt()
    {
        var api = Folder("install", "api");
        Touch(api, EngineLocator.ExecutableName);
        var cli = Folder("install", "cli") + Path.DirectorySeparatorChar;

        new EngineLocator(cli).Locate().Location!.Folder.Should().Be(api);
    }

    [Fact]
    public void Locate_FromInsideATrWebCheckoutsCliApp_FindsTheEngineProjectToBuild()
    {
        var project = ApiProject("repo");
        var bin = Folder("repo", "src", "apps", "cli", "src", "TeensyRom.Cli", "bin", "Debug", "net9.0");

        var found = new EngineLocator(bin).Locate();

        found.Location.Should().Be(new EngineLocation(EngineMode.Source, Path.Combine(_root, "repo"), project));
    }

    [Fact]
    public void Locate_PrefersAPackagedEngineOverTheSource()
    {
        ApiProject("repo");
        var api = Folder("repo", "src", "apps", "cli", "api");
        Touch(api, EngineLocator.ExecutableName);
        var bin = Folder("repo", "src", "apps", "cli", "bin");

        new EngineLocator(bin).Locate().Location!.Mode.Should().Be(EngineMode.Packaged);
    }

    [Fact]
    public void Locate_FromOutsideTheCliApp_RefusesToBuildTheCheckoutItSitsIn()
    {
        ApiProject("repo");
        var elsewhere = Folder("repo", "src", "apps", "api", "src", "TeensyRom.Api", "bin");

        var found = new EngineLocator(elsewhere).Locate();

        found.Location.Should().BeNull();
        found.SearchedFolder.Should().Be(Path.GetFullPath(Path.Combine(elsewhere, "..", "api")));
    }

    [Fact]
    public void Locate_FromAFolderNamedCliOutsideAnAppsFolder_DoesNotWanderUpTheDisk()
    {
        ApiProject("repo");
        var lookalike = Folder("repo", "tools", "cli", "bin");

        new EngineLocator(lookalike).Locate().Location.Should().BeNull();
    }

    [Fact]
    public void Locate_FromTheCliAppOfACheckoutWithoutTheEngineProject_FindsNothing()
    {
        var bin = Folder("repo", "src", "apps", "cli", "bin");

        new EngineLocator(bin).Locate().Location.Should().BeNull();
    }
}
