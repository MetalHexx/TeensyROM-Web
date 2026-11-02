using TeensyRom.Cli.WebUi;

namespace TeensyRom.Cli.Tests;

/// <summary>Which openers each platform tries, and in what order.</summary>
public sealed class BrowserOpenerTests
{
    private const string Url = "http://localhost:10213";

    /// <summary>The opener and address each launch hands the shell that runs it: the arguments after <c>-c</c> and its script.</summary>
    private static string[] Launches(BrowserPlatform platform) =>
        BrowserOpener.StartInfos(Url, platform).Select(info => string.Join(' ', info.ArgumentList.Skip(2))).ToArray();

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

    [Theory]
    [InlineData(nameof(BrowserPlatform.MacOS))]
    [InlineData(nameof(BrowserPlatform.Linux))]
    [InlineData(nameof(BrowserPlatform.Wsl))]
    public void NonWindowsOpeners_RunUnderTheShell_WhichSendsTheirOutputToDevNull_RatherThanThroughPipesNobodyReads(string platform)
    {
        foreach (var info in BrowserOpener.StartInfos(Url, Enum.Parse<BrowserPlatform>(platform)))
        {
            info.FileName.Should().Be("/bin/sh");
            info.ArgumentList[0].Should().Be("-c");
            info.ArgumentList[1].Should().Contain(">/dev/null 2>&1");
            info.UseShellExecute.Should().BeFalse();
            info.RedirectStandardOutput.Should().BeFalse();
            info.RedirectStandardError.Should().BeFalse();
            info.RedirectStandardInput.Should().BeFalse();
        }
    }

    [Fact]
    public void TheOpenerAndTheAddress_ArePassedAsArguments_NotBuiltIntoTheScript()
    {
        var info = BrowserOpener.StartInfos("http://localhost:10213/?a=b&c='d'", BrowserPlatform.Linux).Single();

        info.ArgumentList[1].Should().NotContain("localhost").And.NotContain("xdg-open");
        info.ArgumentList.Skip(2).Should().Equal("xdg-open", "http://localhost:10213/?a=b&c='d'");
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
