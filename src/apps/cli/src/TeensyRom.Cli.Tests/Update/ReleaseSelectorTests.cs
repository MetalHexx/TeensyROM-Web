using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

public sealed class ReleaseSelectorTests
{
    internal static ReleaseInfo Release(string tag, bool preRelease = false, params string[] rids)
    {
        var version = SemVersionTests.V(tag);

        return new ReleaseInfo(
            tag, version, preRelease, null,
            rids.Select(rid => new ReleaseAsset(PlatformRid.AssetName(version, rid), $"https://example.test/{tag}/{rid}", 1000, "sha256:" + new string('a', 64))).ToList());
    }

    [Theory]
    [InlineData("1.0.0", "1.0.0-beta.1", true)]
    [InlineData("1.0.0", "0.9.0", true)]
    [InlineData("1.0.0-beta.2", "1.0.0-beta.1", true)]
    [InlineData("1.0.0-beta.2", "0.9.0", false)]
    public void Admits_AStableReleaseAlways_AndAPreReleaseOnlyForAPreReleaseInstall(string candidate, string installed, bool expected)
    {
        ReleaseSelector.Admits(Release(candidate, rids: "win-x64"), SemVersionTests.V(installed)).Should().Be(expected);
    }

    [Fact]
    public void Admits_TreatsGitHubsPreReleaseFlagAsAPreRelease()
    {
        ReleaseSelector.Admits(Release("1.0.0", preRelease: true), SemVersionTests.V("0.9.0")).Should().BeFalse();
    }

    [Fact]
    public void Newest_IsTheHighestVersionThatHasAPackageForThisPlatform()
    {
        var releases = new[]
        {
            Release("1.0.0", false, "win-x64", "linux-x64"),
            Release("1.1.0", false, "linux-x64"),
            Release("1.2.0", false, "win-x64"),
            Release("1.0.5", false, "win-x64"),
            Release("1.1.5", false, "linux-arm64")
        };

        ReleaseSelector.Newest(releases, SemVersionTests.V("1.0.0"), "win-x64")!.Tag.Should().Be("1.2.0");
        ReleaseSelector.Newest(releases, SemVersionTests.V("1.0.0"), "linux-x64")!.Tag.Should().Be("1.1.0");
        ReleaseSelector.Newest(releases, SemVersionTests.V("1.0.0"), "linux-arm64")!.Tag.Should().Be("1.1.5");
        ReleaseSelector.Newest(releases, SemVersionTests.V("1.0.0"), "osx-arm64").Should().BeNull();
    }

    [Fact]
    public void Newest_ForAStableInstallSkipsPreReleases()
    {
        var releases = new[] { Release("1.0.0", false, "win-x64"), Release("1.1.0-beta.1", true, "win-x64") };

        ReleaseSelector.Newest(releases, SemVersionTests.V("1.0.0"), "win-x64")!.Tag.Should().Be("1.0.0");
    }

    [Fact]
    public void Newest_ForAPreReleaseInstallConsidersEverything()
    {
        var releases = new[] { Release("1.0.0-beta.1", true, "win-x64"), Release("1.0.0-beta.2", true, "win-x64"), Release("0.9.0", false, "win-x64") };

        ReleaseSelector.Newest(releases, SemVersionTests.V("1.0.0-beta.1"), "win-x64")!.Tag.Should().Be("1.0.0-beta.2");
    }

    [Fact]
    public void PackageFor_FindsTheAssetByTheNameTheWorkflowGivesIt()
    {
        var release = Release("v1.0.0-beta.1", true, "win-x64", "linux-x64", "linux-arm64");

        ReleaseSelector.PackageFor(release, "linux-x64")!.Name.Should().Be("TeensyROM-Suite-1.0.0-beta.1-linux-x64.tar.gz");
        ReleaseSelector.PackageFor(release, "linux-arm64")!.Name.Should().Be("TeensyROM-Suite-1.0.0-beta.1-linux-arm64.tar.gz");
        ReleaseSelector.PackageFor(release, "osx-x64").Should().BeNull();
    }
}
