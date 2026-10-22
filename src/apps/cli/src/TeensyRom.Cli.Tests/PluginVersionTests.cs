using System.Text.Json;
using System.Xml.Linq;

namespace TeensyRom.Cli.Tests;

/// <summary>The trom-agent plugin ships with the tool suite, so its manifest carries the suite's version.</summary>
public class PluginVersionTests
{
    [Fact]
    public void PluginManifest_CarriesTheSameVersionAsVersionProps()
    {
        var src = FindSrcFolder();
        var suiteVersion = XDocument.Load(Path.Combine(src, "apps", "Version.props")).Descendants("Version").Single().Value.Trim();
        var manifest = Path.Combine(src, "plugins", "trom-agent", "claude", ".claude-plugin", "plugin.json");

        using var document = JsonDocument.Parse(File.ReadAllText(manifest));

        document.RootElement.GetProperty("version").GetString()
            .Should().Be(suiteVersion, "plugin.json is bumped with src/apps/Version.props on every release");
    }

    private static string FindSrcFolder()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            if (File.Exists(Path.Combine(dir.FullName, "apps", "Version.props"))) return dir.FullName;
        }

        throw new InvalidOperationException("src/apps/Version.props wasn't found above the test assembly.");
    }
}
