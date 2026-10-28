using System.Text.Json;
using TeensyRom.Api.Endpoints.DjLibrary;
using TeensyRom.Api.Endpoints.DjLibrary.SaveTuneMemory;

namespace TeensyRom.Api.Tests.Unit.Endpoints.DjLibrary;

public class SaveTuneMemoryRequestValidatorTests
{
    private const string SidHash = "0123456789abcdef0123456789abcdef";

    private readonly SaveTuneMemoryRequestValidator _validator = new();

    private static DjSubtuneMemoryDto Subtune(int number = 1) => new()
    {
        Subtune = number,
        Settings = JsonDocument.Parse("""{ "v": 1 }""").RootElement.Clone(),
        Markers =
        [
            new DjLoopMarkerDto
            {
                Id = "c1",
                Name = "Drum break",
                Start = new DjLoopBoundaryDto { Frame = 7950, OffsetFrames = 0 },
                Voices = [0, 1, 2]
            }
        ]
    };

    private static SaveTuneMemoryRequest ValidRequest() => new()
    {
        SidHash = SidHash,
        Body = new DjTuneMemoryDto
        {
            SidHash = SidHash,
            LastSubtune = 1,
            Subtunes = [Subtune()],
            Updated = "2026-10-26T21:02:44.871Z"
        }
    };

    private static SaveTuneMemoryRequest With(Action<SaveTuneMemoryRequest> change)
    {
        var request = ValidRequest();
        change(request);
        return request;
    }

    private void AssertPasses(SaveTuneMemoryRequest request)
    {
        var result = _validator.Validate(request);
        result.IsValid.Should().BeTrue(string.Join("; ", result.Errors.Select(e => e.PropertyName + " " + e.ErrorMessage)));
    }

    private void AssertRejectedAt(SaveTuneMemoryRequest request, string propertyName)
    {
        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == propertyName,
            $"errors were: {string.Join("; ", result.Errors.Select(e => e.PropertyName + " " + e.ErrorMessage))}");
    }

    [Fact]
    public void ValidRequest_Passes() => AssertPasses(ValidRequest());

    [Fact]
    public void EmptyMemory_Passes() => AssertPasses(With(r => r.Body.Subtunes = []));

    [Fact]
    public void RouteSidHash_MustBe32LowercaseHex()
    {
        AssertRejectedAt(With(r => r.SidHash = SidHash.ToUpperInvariant()), "SidHash");
        AssertRejectedAt(With(r => r.SidHash = SidHash[..31]), "SidHash");
    }

    [Fact]
    public void BodySidHashDifferentFromRoute_IsRejected() =>
        AssertRejectedAt(With(r => r.Body.SidHash = new string('b', 32)), "Body.SidHash");

    [Fact]
    public void BodySidHash_MustBe32LowercaseHex() =>
        AssertRejectedAt(With(r => r.Body.SidHash = "xyz"), "Body.SidHash");

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(256, true)]
    [InlineData(257, false)]
    public void LastSubtune_IsBounded(int lastSubtune, bool valid)
    {
        var request = With(r => r.Body.LastSubtune = lastSubtune);

        if (valid) AssertPasses(request); else AssertRejectedAt(request, "Body.LastSubtune");
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(256, true)]
    [InlineData(257, false)]
    public void MemorySubtune_IsBounded(int number, bool valid)
    {
        var request = With(r => r.Body.Subtunes = [Subtune(number)]);

        if (valid) AssertPasses(request); else AssertRejectedAt(request, "Body.Subtunes[0].Subtune");
    }

    [Fact]
    public void DuplicateSubtunes_AreRejected() =>
        AssertRejectedAt(With(r => r.Body.Subtunes = [Subtune(2), Subtune(2)]), "Body.Subtunes[1].Subtune");

    [Fact]
    public void Updated_MustBeIso8601() =>
        AssertRejectedAt(With(r => r.Body.Updated = "later"), "Body.Updated");

    [Fact]
    public void MarkerRules_ApplyToMemorySubtunes()
    {
        AssertRejectedAt(With(r => r.Body.Subtunes[0].Markers[0].Id = "no good"), "Body.Subtunes[0].Markers[0].Id");
        AssertRejectedAt(With(r => r.Body.Subtunes[0].Markers[0].Voices = [4]), "Body.Subtunes[0].Markers[0].Voices");
        AssertRejectedAt(With(r => r.Body.Subtunes[0].Markers[0].Start.Frame = -1), "Body.Subtunes[0].Markers[0].Start.Frame");
    }

    [Fact]
    public void SubtuneSettings_AreBoundedTo8192Characters()
    {
        var oversized = JsonDocument.Parse("{\"a\":\"" + new string('x', 8190) + "\"}").RootElement.Clone();

        AssertRejectedAt(With(r => r.Body.Subtunes[0].Settings = oversized), "Body.Subtunes[0].Settings");
    }
}
