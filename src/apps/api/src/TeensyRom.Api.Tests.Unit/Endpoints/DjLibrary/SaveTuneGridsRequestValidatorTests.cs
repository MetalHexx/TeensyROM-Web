using TeensyRom.Api.Endpoints.DjLibrary;
using TeensyRom.Api.Endpoints.DjLibrary.SaveTuneGrids;

namespace TeensyRom.Api.Tests.Unit.Endpoints.DjLibrary;

public class SaveTuneGridsRequestValidatorTests
{
    private const string SidHash = "0123456789abcdef0123456789abcdef";

    private readonly SaveTuneGridsRequestValidator _validator = new();

    private static DjSubtuneGridDto Grid(int subtune = 1, int beatFrames = 24, int beatOneFrame = 0) =>
        new() { Subtune = subtune, BeatFrames = beatFrames, BeatOneFrame = beatOneFrame };

    private static SaveTuneGridsRequest ValidRequest() => new()
    {
        SidHash = SidHash,
        Body = new DjTuneGridsDto { SidHash = SidHash, Subtunes = [Grid()], Updated = "2026-10-26T21:02:44.871Z" }
    };

    private static SaveTuneGridsRequest With(Action<SaveTuneGridsRequest> change)
    {
        var request = ValidRequest();
        change(request);
        return request;
    }

    private void AssertPasses(SaveTuneGridsRequest request)
    {
        var result = _validator.Validate(request);
        result.IsValid.Should().BeTrue(string.Join("; ", result.Errors.Select(e => e.PropertyName + " " + e.ErrorMessage)));
    }

    private void AssertRejectedAt(SaveTuneGridsRequest request, string propertyName)
    {
        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == propertyName,
            $"errors were: {string.Join("; ", result.Errors.Select(e => e.PropertyName + " " + e.ErrorMessage))}");
    }

    [Fact]
    public void ValidRequest_Passes() => AssertPasses(ValidRequest());

    [Fact]
    public void NoGrids_Passes() => AssertPasses(With(r => r.Body.Subtunes = []));

    [Fact]
    public void RouteSidHash_MustBe32LowercaseHex()
    {
        AssertRejectedAt(With(r => r.SidHash = SidHash.ToUpperInvariant()), "SidHash");
        AssertRejectedAt(With(r => r.SidHash = SidHash[..31]), "SidHash");
    }

    [Fact]
    public void BodySidHash_MustBe32LowercaseHex() =>
        AssertRejectedAt(With(r => r.Body.SidHash = "xyz"), "Body.SidHash");

    [Fact]
    public void BodySidHashDifferentFromRoute_IsRejected() =>
        AssertRejectedAt(With(r => r.Body.SidHash = new string('b', 32)), "Body.SidHash");

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(256, true)]
    [InlineData(257, false)]
    public void Subtune_IsBounded(int number, bool valid)
    {
        var request = With(r => r.Body.Subtunes = [Grid(number)]);

        if (valid) AssertPasses(request); else AssertRejectedAt(request, "Body.Subtunes[0].Subtune");
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(4096, true)]
    [InlineData(4097, false)]
    public void BeatFrames_IsBounded(int beatFrames, bool valid)
    {
        var request = With(r => r.Body.Subtunes = [Grid(beatFrames: beatFrames)]);

        if (valid) AssertPasses(request); else AssertRejectedAt(request, "Body.Subtunes[0].BeatFrames");
    }

    [Theory]
    [InlineData(-1, false)]
    [InlineData(0, true)]
    public void BeatOneFrame_IsZeroOrMore(int beatOneFrame, bool valid)
    {
        var request = With(r => r.Body.Subtunes = [Grid(beatOneFrame: beatOneFrame)]);

        if (valid) AssertPasses(request); else AssertRejectedAt(request, "Body.Subtunes[0].BeatOneFrame");
    }

    [Fact]
    public void DuplicateSubtunes_AreRejected() =>
        AssertRejectedAt(With(r => r.Body.Subtunes = [Grid(2), Grid(2)]), "Body.Subtunes[1].Subtune");

    [Fact]
    public void AtMost256Subtunes()
    {
        AssertPasses(With(r => r.Body.Subtunes = Enumerable.Range(1, 256).Select(n => Grid(n)).ToList()));
        AssertRejectedAt(With(r => r.Body.Subtunes = Enumerable.Range(1, 257).Select(n => Grid(n)).ToList()), "Body.Subtunes");
    }

    [Fact]
    public void Updated_MustBeIso8601() =>
        AssertRejectedAt(With(r => r.Body.Updated = "later"), "Body.Updated");
}
