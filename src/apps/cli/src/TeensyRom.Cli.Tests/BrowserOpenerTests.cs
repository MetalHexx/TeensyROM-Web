using TeensyRom.Cli.WebUi;

namespace TeensyRom.Cli.Tests;

/// <summary>Which openers each platform tries, and in what order.</summary>
public sealed class BrowserOpenerTests
{
    private const string Url = "http://localhost:10213";

    private static string[] Launches(BrowserPlatform platform) =>
        BrowserOpener.StartInfos(Url, platform).Select(info => $"{info.FileName} {string.Join(' ', info.ArgumentList)}".TrimEnd()).ToArray();

    [Fact]
    public void Windows_ShellExecutesTheUrl()
    {
        var info = BrowserOpener.StartInfos(Url, BrowserPlatform.Windows).Should().ContainSingle().Subject;

        info.FileName.Should().Be(Url);
        info.UseShellExecute.Should().BeTrue();
    }

    [Fact]
    public void MacOs_UsesOpen() => Launches(BrowserPlatform.MacOS).Should().Equal($"open {Url}");

    [Fact]
    public void Linux_UsesXdgOpen() => Launches(BrowserPlatform.Linux).Should().Equal($"xdg-open {Url}");

    [Fact]
    public void Wsl_TriesWslviewThenXdgOpen() => Launches(BrowserPlatform.Wsl).Should().Equal($"wslview {Url}", $"xdg-open {Url}");

    [Fact]
    public void NonWindowsOpeners_AreDirectProcesses_WhoseOutputStaysOffTheTerminal()
    {
        foreach (var info in BrowserOpener.StartInfos(Url, BrowserPlatform.Wsl))
        {
            info.UseShellExecute.Should().BeFalse();
            info.RedirectStandardOutput.Should().BeTrue();
            info.RedirectStandardError.Should().BeTrue();
        }
    }

    [Theory]
    [InlineData(true, false, null, "Windows")]
    [InlineData(false, true, null, "MacOS")]
    [InlineData(false, false, null, "Linux")]
    [InlineData(false, false, "", "Linux")]
    [InlineData(false, false, "Ubuntu", "Wsl")]
    public void Detect_ReadsTheOperatingSystem_AndTheWslDistroVariable(bool windows, bool macOs, string? distro, string expected)
    {
        BrowserOpener.Detect(windows, macOs, distro).ToString().Should().Be(expected);
    }
}
