using TeensyRom.Cli.Common;

namespace TeensyRom.Cli.Tests;

public sealed class LocalTargetPathTests
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "trom-target-root");

    [Theory]
    [InlineData("..")]
    [InlineData(".")]
    [InlineData("")]
    [InlineData("/etc/passwd")]
    [InlineData("\\windows\\system32")]
    [InlineData("C:")]
    [InlineData("C:evil.prg")]
    [InlineData("a:b")]
    [InlineData("a/b")]
    [InlineData("nul\0name")]
    public void AnUnsafeSegment_IsRejected_AndNamesTheOffender(string segment)
    {
        var (full, problem) = LocalTargetPath.Resolve(_root, ["games", segment]);

        full.Should().BeNull();
        problem.Should().EndWith("can't be saved on this computer under that name.");
    }

    [Fact]
    public void ADotDotAnywhereInTheChain_IsRejected_SoNothingLandsOutsideTheRoot()
    {
        var (full, problem) = LocalTargetPath.Resolve(_root, ["..", "outside.prg"]);

        full.Should().BeNull();
        problem.Should().StartWith(".. can't be saved");
    }

    [Theory]
    [InlineData("CON")]
    [InlineData("con.txt")]
    [InlineData("Aux.prg")]
    [InlineData("NUL")]
    [InlineData("COM1")]
    [InlineData("lpt9.sid")]
    public void AReservedWindowsName_IsRejectedOnWindowsOnly(string name)
    {
        var (full, problem) = LocalTargetPath.Resolve(_root, [name]);

        if (OperatingSystem.IsWindows())
        {
            full.Should().BeNull();
            problem.Should().Contain(name);
        }
        else
        {
            full.Should().NotBeNull();
        }
    }

    [Fact]
    public void ANameWindowsWouldQuietlyChange_IsRejectedOnWindows()
    {
        if (!OperatingSystem.IsWindows()) return;

        LocalTargetPath.Resolve(_root, ["game."]).FullPath.Should().BeNull();
        LocalTargetPath.Resolve(_root, ["game "]).FullPath.Should().BeNull();
        LocalTargetPath.Resolve(_root, ["..."]).FullPath.Should().BeNull();
    }

    [Fact]
    public void NestedValidSegments_ResolveInsideTheRoot()
    {
        var (full, problem) = LocalTargetPath.Resolve(_root, ["games", "sub", "Commando (v2).sid"]);

        problem.Should().BeNull();
        full.Should().Be(Path.GetFullPath(Path.Combine(_root, "games", "sub", "Commando (v2).sid")));
        full.Should().StartWith(Path.GetFullPath(_root) + Path.DirectorySeparatorChar);
    }

    [Fact]
    public void ARootWithATrailingSeparator_StillContainsItsFiles()
    {
        var (full, problem) = LocalTargetPath.Resolve(_root + Path.DirectorySeparatorChar, ["a.prg"]);

        problem.Should().BeNull();
        full.Should().Be(Path.Combine(Path.GetFullPath(_root), "a.prg"));
    }

    [Fact]
    public void NoSegments_IsAProblem()
    {
        LocalTargetPath.Resolve(_root, []).Problem.Should().NotBeNull();
    }
}
