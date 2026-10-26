using TeensyRom.Api.Transfers;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class LaunchCandidateRankerTests
{
    [Theory]
    [InlineData("/x/a.prg", 0)]
    [InlineData("/x/a.CRT", 0)]
    [InlineData("/x/a.p00", 0)]
    [InlineData("/x/a.sid", 1)]
    [InlineData("/x/a.kla", 2)]
    [InlineData("/x/a.koa", 2)]
    [InlineData("/x/a.art", 2)]
    [InlineData("/x/a.aas", 2)]
    [InlineData("/x/a.hpi", 2)]
    [InlineData("/x/a.seq", 2)]
    [InlineData("/x/a.txt", 2)]
    [InlineData("/x/a.hex", 3)]
    public void RankOf_LaunchableTypes_ReturnsTheirRank(string path, int expected)
    {
        LaunchCandidateRanker.RankOf(path).Should().Be(expected);
    }

    [Theory]
    [InlineData("/x/a.trh")]
    [InlineData("/x/a.TRH")]
    [InlineData("/x/a.d64")]
    [InlineData("/x/a.zip")]
    [InlineData("/x/a.nfo")]
    [InlineData("/x/a.reu")]
    [InlineData("/x/a.d71")]
    [InlineData("/x/a.md")]
    [InlineData("/x/noextension")]
    public void RankOf_NeverLaunchedTypes_ReturnsNull(string path)
    {
        LaunchCandidateRanker.RankOf(path).Should().BeNull();
    }

    [Theory]
    [InlineData("/x/a.prg", "/x/a.sid", true)]
    [InlineData("/x/a.sid", "/x/a.prg", false)]
    [InlineData("/x/a.sid", "/x/a.hex", true)]
    [InlineData("/x/a.hex", "/x/a.sid", false)]
    [InlineData("/x/a.hex", null, true)]
    [InlineData("/x/a.d64", null, false)]
    [InlineData("/x/a.d64", "/x/z.hex", false)]
    [InlineData("/x/a.hex", "/x/z.d64", true)]
    public void IsBetter_ComparesByRank(string candidate, string? current, bool expected)
    {
        LaunchCandidateRanker.IsBetter(candidate, current).Should().Be(expected);
    }

    [Fact]
    public void IsBetter_EqualRank_EarlierFileNameWinsAcrossSubfolders()
    {
        LaunchCandidateRanker.IsBetter("/x/c/a.prg", "/x/b/z.prg").Should().BeTrue();
        LaunchCandidateRanker.IsBetter("/x/b/z.prg", "/x/c/a.prg").Should().BeFalse();
    }

    [Fact]
    public void IsBetter_FileNameComparisonIgnoresCase()
    {
        LaunchCandidateRanker.IsBetter("/x/A.prg", "/x/b.prg").Should().BeTrue();
        LaunchCandidateRanker.IsBetter("/x/b.prg", "/x/A.prg").Should().BeFalse();
    }

    [Fact]
    public void IsBetter_EqualRankAndName_EarlierFullPathWins()
    {
        LaunchCandidateRanker.IsBetter("/x/a/game.prg", "/x/b/game.prg").Should().BeTrue();
        LaunchCandidateRanker.IsBetter("/x/b/game.prg", "/x/a/game.prg").Should().BeFalse();
    }

    [Fact]
    public void IsBetter_SamePath_IsNotBetter()
    {
        LaunchCandidateRanker.IsBetter("/x/a.prg", "/x/a.prg").Should().BeFalse();
    }
}
