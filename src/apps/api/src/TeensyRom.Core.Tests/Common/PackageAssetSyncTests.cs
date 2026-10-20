using System.IO.Compression;
using TeensyRom.Core.Common;

namespace TeensyRom.Core.Tests.Common;

public class PackageAssetSyncTests : IDisposable
{
    private const string Version = "1.2.3";

    private readonly string _root = Directory.CreateTempSubdirectory("teensyrom-asset-sync-").FullName;
    private readonly string _package;
    private readonly string _home;

    public PackageAssetSyncTests()
    {
        _package = Path.Combine(_root, "package", "Assets");
        _home = Path.Combine(_root, "home", "Assets");
    }

    public void Dispose() => Directory.Delete(_root, recursive: true);

    private string Marker => Path.Combine(_home, TeensyRomHome.PackageVersionFileName);

    private static void WriteFile(string path, string content = "content")
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, content);
    }

    private static void WriteZip(string zipPath, string entryName, string content)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(zipPath)!);
        using var archive = ZipFile.Open(zipPath, ZipArchiveMode.Create);
        var entry = archive.CreateEntry(entryName);
        using var writer = new StreamWriter(entry.Open());
        writer.Write(content);
    }

    [Fact]
    public void Sync_OnAFreshHome_CopiesFilesExtractsZipsKeepsThePackageZipAndWritesTheMarker()
    {
        WriteFile(Path.Combine(_package, "Other", "logo.png"), "png");
        WriteFile(Path.Combine(_package, "Music", "SidList", "hvsc.csv"), "csv");
        WriteZip(Path.Combine(_package, "Game", "Images", "OneLoad64.zip"), "Screenshots/a.png", "art");

        PackageAssetSync.Sync(_package, _home, Version);

        File.ReadAllText(Path.Combine(_home, "Other", "logo.png")).Should().Be("png");
        File.ReadAllText(Path.Combine(_home, "Music", "SidList", "hvsc.csv")).Should().Be("csv");
        File.ReadAllText(Path.Combine(_home, "Game", "Images", "Screenshots", "a.png")).Should().Be("art");
        File.Exists(Path.Combine(_package, "Game", "Images", "OneLoad64.zip")).Should().BeTrue();
        File.Exists(Path.Combine(_home, "Game", "Images", "OneLoad64.zip")).Should().BeFalse();
        File.ReadAllText(Marker).Should().Be(Version);
    }

    [Fact]
    public void Sync_WhenTheMarkerMatchesTheVersion_TouchesNothing()
    {
        WriteFile(Path.Combine(_package, "Other", "logo.png"), "new");
        WriteFile(Path.Combine(_home, "Other", "stale.png"));
        WriteFile(Marker, $"{Version}\r\n");

        PackageAssetSync.Sync(_package, _home, Version);

        File.Exists(Path.Combine(_home, "Other", "stale.png")).Should().BeTrue();
        File.Exists(Path.Combine(_home, "Other", "logo.png")).Should().BeFalse();
    }

    [Fact]
    public void Sync_WhenTheMarkerDiffers_ReplacesStaleAssetsAndKeepsTheSystemFolder()
    {
        WriteFile(Path.Combine(_package, "Music", "SidList", "hvsc-new.csv"));
        WriteFile(Path.Combine(_home, "Music", "SidList", "hvsc-old.csv"));
        WriteFile(Path.Combine(_home, "System", "Config", "Settings.json"), "mine");
        WriteFile(Marker, "0.0.1");

        PackageAssetSync.Sync(_package, _home, Version);

        File.Exists(Path.Combine(_home, "Music", "SidList", "hvsc-old.csv")).Should().BeFalse();
        File.Exists(Path.Combine(_home, "Music", "SidList", "hvsc-new.csv")).Should().BeTrue();
        File.ReadAllText(Path.Combine(_home, "System", "Config", "Settings.json")).Should().Be("mine");
        File.ReadAllText(Marker).Should().Be(Version);
    }

    [Fact]
    public void Sync_NeverCopiesThePackageSystemFolderOrSourceFiles()
    {
        WriteFile(Path.Combine(_package, "System", "Logs", "old.log"));
        WriteFile(Path.Combine(_package, "Other", "Helper.cs"));
        WriteFile(Path.Combine(_package, "Other", "logo.png"));

        PackageAssetSync.Sync(_package, _home, Version);

        Directory.Exists(Path.Combine(_home, "System")).Should().BeFalse();
        File.Exists(Path.Combine(_home, "Other", "Helper.cs")).Should().BeFalse();
        File.Exists(Path.Combine(_home, "Other", "logo.png")).Should().BeTrue();
    }

    [Fact]
    public void Sync_WhenThePackageFolderIsMissing_WritesNothing()
    {
        var act = () => PackageAssetSync.Sync(_package, _home, Version);

        act.Should().NotThrow();
        Directory.Exists(_home).Should().BeFalse();
    }

    [Fact]
    public void Sync_WhenTheCopyFails_LeavesNoMarkerSoTheNextStartRetries()
    {
        WriteFile(Path.Combine(_package, "Other", "logo.png"));
        WriteFile(Path.Combine(_package, "Other", "bad.zip"), "not a zip");

        var act = () => PackageAssetSync.Sync(_package, _home, Version);

        act.Should().Throw<InvalidDataException>();
        File.Exists(Marker).Should().BeFalse();
    }
}
