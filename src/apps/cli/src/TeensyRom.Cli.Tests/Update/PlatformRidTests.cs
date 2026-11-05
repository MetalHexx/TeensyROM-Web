using System.Runtime.InteropServices;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

public sealed class PlatformRidTests
{
    [Theory]
    [InlineData("windows", Architecture.X64, "win-x64")]
    [InlineData("osx", Architecture.X64, "osx-x64")]
    [InlineData("osx", Architecture.Arm64, "osx-arm64")]
    [InlineData("linux", Architecture.X64, "linux-x64")]
    [InlineData("windows", Architecture.Arm64, null)]
    [InlineData("linux", Architecture.Arm64, "linux-arm64")]
    [InlineData("linux", Architecture.Arm, null)]
    [InlineData("linux", Architecture.X86, null)]
    [InlineData("freebsd", Architecture.X64, null)]
    public void For_NamesTheFiveShippedPlatformsAndNothingElse(string os, Architecture architecture, string? expected)
    {
        PlatformRid.For(OSPlatform.Create(os.ToUpperInvariant()), architecture).Should().Be(expected);
    }

    [Theory]
    [InlineData("win-x64", ".zip", "trom.exe", "TeensyRom.Api.exe")]
    [InlineData("osx-arm64", ".tar.gz", "trom", "TeensyRom.Api")]
    [InlineData("osx-x64", ".tar.gz", "trom", "TeensyRom.Api")]
    [InlineData("linux-x64", ".tar.gz", "trom", "TeensyRom.Api")]
    [InlineData("linux-arm64", ".tar.gz", "trom", "TeensyRom.Api")]
    public void Names_FollowTheRid(string rid, string suffix, string trom, string api)
    {
        PlatformRid.ArchiveSuffix(rid).Should().Be(suffix);
        PlatformRid.TromExecutable(rid).Should().Be(trom);
        PlatformRid.ApiExecutable(rid).Should().Be(api);
    }

    [Theory]
    [InlineData("1.0.0-beta.1", "win-x64", "TeensyROM-Suite-1.0.0-beta.1-win-x64.zip")]
    [InlineData("1.2.3", "osx-arm64", "TeensyROM-Suite-1.2.3-osx-arm64.tar.gz")]
    public void AssetName_IsTheNameTheReleaseWorkflowGivesThePackage(string version, string rid, string expected)
    {
        PlatformRid.AssetName(SemVersionTests.V(version), rid).Should().Be(expected);
    }
}
