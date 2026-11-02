using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

public sealed class SemVersionTests
{
    internal static SemVersion V(string text) =>
        SemVersion.TryParse(text, out var version) ? version : throw new FormatException(text);

    [Theory]
    [InlineData("1.2.3", 1, 2, 3, "")]
    [InlineData("v1.2.3", 1, 2, 3, "")]
    [InlineData("1.0.0-beta.1", 1, 0, 0, "beta.1")]
    [InlineData("v1.0.0-rc.1+build.5", 1, 0, 0, "rc.1")]
    [InlineData("1.2.3+abc", 1, 2, 3, "")]
    [InlineData("  1.0.0-alpha.8  ", 1, 0, 0, "alpha.8")]
    [InlineData("0.0.0", 0, 0, 0, "")]
    [InlineData("1.0.0-x-y.0", 1, 0, 0, "x-y.0")]
    public void TryParse_ReadsAVersionAndDropsBuildMetadata(string text, int major, int minor, int patch, string pre)
    {
        SemVersion.TryParse(text, out var version).Should().BeTrue();

        version.Should().Be(new SemVersion(major, minor, patch, pre));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("1")]
    [InlineData("1.2")]
    [InlineData("1.2.3.4")]
    [InlineData("01.2.3")]
    [InlineData("1.2.3-")]
    [InlineData("1.2.3-01")]
    [InlineData("1.2.3-a..b")]
    [InlineData("1.2.3+")]
    [InlineData("x.y.z")]
    [InlineData("Unknown version")]
    [InlineData("99999999999.0.0")]
    public void TryParse_RefusesAnythingThatIsNotSemVer(string? text)
    {
        SemVersion.TryParse(text, out _).Should().BeFalse();
    }

    [Fact]
    public void Precedence_FollowsTheSpecsOwnExample()
    {
        string[] ascending =
        [
            "1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0",
            "1.0.1", "1.1.0", "2.0.0"
        ];

        for (var i = 0; i < ascending.Length; i++)
        {
            for (var j = 0; j < ascending.Length; j++)
            {
                var order = V(ascending[i]).CompareTo(V(ascending[j]));

                Math.Sign(order).Should().Be(Math.Sign(i.CompareTo(j)), $"{ascending[i]} against {ascending[j]}");
            }
        }
    }

    [Fact]
    public void Precedence_ComparesNumbersTooBigForAnIntByTheirSize()
    {
        V("1.0.0-1.99999999999999999999").Should().BeLessThan(V("1.0.0-1.100000000000000000000"));
    }

    [Fact]
    public void Operators_AgreeWithCompareTo()
    {
        (V("1.0.0-beta.1") < V("1.0.0")).Should().BeTrue();
        (V("1.0.0") > V("1.0.0-beta.1")).Should().BeTrue();
        (V("1.0.0") <= V("1.0.0")).Should().BeTrue();
        (V("1.0.0") >= V("1.0.1")).Should().BeFalse();
    }

    [Fact]
    public void BuildMetadata_DoesNotMakeVersionsDiffer()
    {
        V("1.0.0+a").Should().Be(V("1.0.0+b"));
    }

    [Theory]
    [InlineData("v1.0.0-beta.1+abc", "1.0.0-beta.1")]
    [InlineData("1.2.3", "1.2.3")]
    public void ToString_IsTheVersionAsItIsInAnAssetName(string text, string expected)
    {
        V(text).ToString().Should().Be(expected);
    }

    [Theory]
    [InlineData("1.0.0-beta.1", true)]
    [InlineData("1.0.0", false)]
    public void IsPreRelease_IsTrueForAVersionWithAPreReleaseTag(string text, bool expected)
    {
        V(text).IsPreRelease.Should().Be(expected);
    }
}
