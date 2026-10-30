using System.Text.Json;
using TeensyRom.Api.Endpoints.DjLibrary;
using TeensyRom.Api.Endpoints.DjLibrary.SaveDjSet;

namespace TeensyRom.Api.Tests.Unit.Endpoints.DjLibrary;

public class SaveDjSetRequestValidatorTests
{
    private const string SetId = "6f1c2b0e-8d1a-4c7e-9a43-2a1b7c9d0e11";
    private const string RowId = "0b6e3c1a-5f2d-4e8b-b7a9-1c2d3e4f5a6b";
    private const string SidHash = "0123456789abcdef0123456789abcdef";

    private readonly SaveDjSetRequestValidator _validator = new();

    private static JsonElement Opaque(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static DjLoopMarkerDto Marker(string id = "c1") => new()
    {
        Id = id,
        Name = "Drum break",
        Start = new DjLoopBoundaryDto { Frame = 7950, OffsetFrames = 0 },
        End = new DjLoopBoundaryDto { Frame = 8360, OffsetFrames = 6 },
        Voices = [0, 1, 2],
        Settings = Opaque("""{ "v": 1 }"""),
        UsesOwnSettings = true,
        Wraps = true
    };

    private static DjSubtuneMemoryDto Subtune(int number = 1) => new()
    {
        Subtune = number,
        Settings = Opaque("""{ "v": 1 }"""),
        Markers = [Marker()]
    };

    private static DjSetRowDto Row(string id = RowId, string sidHash = SidHash) => new()
    {
        Id = id,
        Tune = new DjRowTuneDto { SidHash = sidHash, Title = "Commando", Author = "Rob Hubbard", Released = "1985 Elite", SubtuneCount = 3, ByteLength = 6234 },
        CopiedFrom = new DjMemoryLinkDto { SidHash = sidHash, Updated = "2026-10-25T18:00:00.000Z" },
        LastSubtune = 1,
        Subtunes = [Subtune()],
        Host = Opaque("""{ "v": 1 }""")
    };

    private static SaveDjSetRequest ValidRequest() => new()
    {
        SetId = SetId,
        Body = new DjSetDto
        {
            Id = SetId,
            Name = "Friday warm-up",
            Placeholder = "Set 3",
            Created = "2026-10-26T20:15:03.120Z",
            Updated = "2026-10-26T21:02:44.871Z",
            Rows = [Row()]
        }
    };

    private static SaveDjSetRequest With(Action<SaveDjSetRequest> change)
    {
        var request = ValidRequest();
        change(request);
        return request;
    }

    private static SaveDjSetRequest WithRow(Action<DjSetRowDto> change) => With(r => change(r.Body.Rows[0]));

    private static SaveDjSetRequest WithMarker(Action<DjLoopMarkerDto> change) => With(r => change(r.Body.Rows[0].Subtunes[0].Markers[0]));

    private void AssertPasses(SaveDjSetRequest request)
    {
        var result = _validator.Validate(request);
        result.IsValid.Should().BeTrue(string.Join("; ", result.Errors.Select(e => e.PropertyName + " " + e.ErrorMessage)));
    }

    private void AssertRejectedAt(SaveDjSetRequest request, string propertyName)
    {
        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == propertyName,
            $"errors were: {string.Join("; ", result.Errors.Select(e => e.PropertyName + " " + e.ErrorMessage))}");
    }

    [Fact]
    public void ValidRequest_Passes() => AssertPasses(ValidRequest());

    [Fact]
    public void NullOpaqueValuesAndOptionalFields_Pass()
    {
        AssertPasses(With(r =>
        {
            var row = r.Body.Rows[0];
            row.Host = null;
            row.CopiedFrom = null;
            row.Subtunes[0].Settings = null;
            row.Subtunes[0].Markers[0].Settings = null;
            row.Subtunes[0].Markers[0].Name = null;
            row.Subtunes[0].Markers[0].End = null;
            row.Subtunes[0].Markers[0].UsesOwnSettings = null;
            row.Subtunes[0].Markers[0].Wraps = null;
        }));
    }

    [Fact]
    public void RouteIdThatIsNotACanonicalGuid_IsRejected()
    {
        AssertRejectedAt(With(r => r.SetId = SetId.ToUpperInvariant()), "SetId");
        AssertRejectedAt(With(r => r.SetId = "not-a-guid"), "SetId");
    }

    [Fact]
    public void BodyIdDifferentFromRouteId_IsRejected() =>
        AssertRejectedAt(With(r => r.Body.Id = Guid.NewGuid().ToString("D")), "Body.Id");

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(64, true)]
    [InlineData(65, false)]
    public void NameLength_IsBounded(int length, bool valid)
    {
        var request = With(r => r.Body.Name = new string('a', length));

        if (valid) AssertPasses(request); else AssertRejectedAt(request, "Body.Name");
    }

    [Fact]
    public void NameAndPlaceholder_AreTrimmedAndFreeOfControlCharacters()
    {
        AssertRejectedAt(With(r => r.Body.Name = "   "), "Body.Name");
        AssertPasses(With(r => r.Body.Name = " " + new string('a', 64) + " "));
        AssertRejectedAt(With(r => r.Body.Name = "bad\u0007name"), "Body.Name");
        AssertRejectedAt(With(r => r.Body.Placeholder = ""), "Body.Placeholder");
        AssertRejectedAt(With(r => r.Body.Placeholder = new string('a', 65)), "Body.Placeholder");
        AssertRejectedAt(With(r => r.Body.Placeholder = "tab\there"), "Body.Placeholder");
    }

    [Fact]
    public void Timestamps_MustBeIso8601()
    {
        AssertRejectedAt(With(r => r.Body.Created = "yesterday"), "Body.Created");
        AssertRejectedAt(With(r => r.Body.Updated = ""), "Body.Updated");
        AssertRejectedAt(WithRow(row => row.CopiedFrom!.Updated = "nope"), "Body.Rows[0].CopiedFrom.Updated");
    }

    [Fact]
    public void RowCount_IsBounded()
    {
        AssertPasses(With(r => r.Body.Rows = Enumerable.Range(0, 1000).Select(i => Row(new Guid(i + 1, 0, 0, new byte[8]).ToString("D"), i.ToString("x32"))).ToList()));
        AssertRejectedAt(With(r => r.Body.Rows = Enumerable.Range(0, 1001).Select(i => Row(new Guid(i + 1, 0, 0, new byte[8]).ToString("D"), i.ToString("x32"))).ToList()), "Body.Rows");
    }

    [Fact]
    public void DuplicateRowIds_AreRejected() =>
        AssertRejectedAt(With(r => r.Body.Rows = [Row(), Row(sidHash: new string('b', 32))]), "Body.Rows[1].Id");

    [Fact]
    public void DuplicateSidHashAcrossRows_IsRejected() =>
        AssertRejectedAt(With(r => r.Body.Rows = [Row(), Row(Guid.NewGuid().ToString("D"))]), "Body.Rows[1].Tune.SidHash");

    [Fact]
    public void RowId_MustBeACanonicalGuid() => AssertRejectedAt(WithRow(row => row.Id = "row-1"), "Body.Rows[0].Id");

    [Theory]
    [InlineData("0123456789abcdef0123456789abcde")]
    [InlineData("0123456789abcdef0123456789abcdef0")]
    [InlineData("0123456789ABCDEF0123456789ABCDEF")]
    [InlineData("0123456789abcdef0123456789abcdeg")]
    public void SidHash_MustBe32LowercaseHex(string hash)
    {
        AssertRejectedAt(WithRow(row =>
        {
            row.Tune.SidHash = hash;
            row.CopiedFrom = null;
        }), "Body.Rows[0].Tune.SidHash");
    }

    [Fact]
    public void CopiedFromSidHash_MustEqualTheTuneSidHash()
    {
        AssertRejectedAt(WithRow(row => row.CopiedFrom!.SidHash = new string('b', 32)), "Body.Rows[0].CopiedFrom.SidHash");
    }

    [Theory]
    [InlineData(64, true)]
    [InlineData(65, false)]
    public void TuneText_IsBoundedTo64Characters(int length, bool valid)
    {
        var text = new string('x', length);
        foreach (var (apply, key) in new (Action<DjRowTuneDto>, string)[]
        {
            (t => t.Title = text, "Title"), (t => t.Author = text, "Author"), (t => t.Released = text, "Released")
        })
        {
            var request = WithRow(row => apply(row.Tune));
            if (valid) AssertPasses(request); else AssertRejectedAt(request, $"Body.Rows[0].Tune.{key}");
        }
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(256, true)]
    [InlineData(257, false)]
    public void SubtuneCount_IsBounded(int count, bool valid)
    {
        var request = WithRow(row =>
        {
            row.Tune.SubtuneCount = count;
            row.Subtunes = [Subtune()];
        });

        if (valid) AssertPasses(request); else AssertRejectedAt(request, "Body.Rows[0].Tune.SubtuneCount");
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(1_048_576, true)]
    [InlineData(1_048_577, false)]
    public void ByteLength_IsBounded(int length, bool valid)
    {
        var request = WithRow(row => row.Tune.ByteLength = length);

        if (valid) AssertPasses(request); else AssertRejectedAt(request, "Body.Rows[0].Tune.ByteLength");
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(3, true)]
    [InlineData(4, false)]
    public void LastSubtune_MustBeWithinTheSubtuneCount(int lastSubtune, bool valid)
    {
        var request = WithRow(row => row.LastSubtune = lastSubtune);

        if (valid) AssertPasses(request); else AssertRejectedAt(request, "Body.Rows[0].LastSubtune");
    }

    [Fact]
    public void MemorySubtune_MustBeWithinTheSubtuneCount()
    {
        AssertPasses(WithRow(row => row.Subtunes = [Subtune(3)]));
        AssertRejectedAt(WithRow(row => row.Subtunes = [Subtune(4)]), "Body.Rows[0].Subtunes[0].Subtune");
        AssertRejectedAt(WithRow(row => row.Subtunes = [Subtune(0)]), "Body.Rows[0].Subtunes[0].Subtune");
    }

    [Fact]
    public void DuplicateMemorySubtunes_AreRejected() =>
        AssertRejectedAt(WithRow(row => row.Subtunes = [Subtune(2), Subtune(2)]), "Body.Rows[0].Subtunes[1].Subtune");

    [Fact]
    public void MarkerCount_IsBoundedAndIdsAreUniqueWithinTheSubtune()
    {
        AssertPasses(WithRow(row => row.Subtunes[0].Markers = Enumerable.Range(0, 128).Select(i => Marker($"m{i}")).ToList()));
        AssertRejectedAt(WithRow(row => row.Subtunes[0].Markers = Enumerable.Range(0, 129).Select(i => Marker($"m{i}")).ToList()),
            "Body.Rows[0].Subtunes[0].Markers");
        AssertRejectedAt(WithRow(row => row.Subtunes[0].Markers = [Marker("a"), Marker("a")]), "Body.Rows[0].Subtunes[0].Markers[1].Id");
    }

    [Theory]
    [InlineData("", false)]
    [InlineData("a", true)]
    [InlineData("A_b-9", true)]
    [InlineData("has space", false)]
    [InlineData("tail\n", false)]
    public void MarkerId_IsRestricted(string id, bool valid)
    {
        var request = WithMarker(m => m.Id = id);

        if (valid) AssertPasses(request); else AssertRejectedAt(request, "Body.Rows[0].Subtunes[0].Markers[0].Id");
    }

    [Fact]
    public void MarkerId_IsLimitedTo64Characters()
    {
        AssertPasses(WithMarker(m => m.Id = new string('a', 64)));
        AssertRejectedAt(WithMarker(m => m.Id = new string('a', 65)), "Body.Rows[0].Subtunes[0].Markers[0].Id");
    }

    [Fact]
    public void MarkerName_IsNullOr1To48CharactersWithoutControls()
    {
        AssertPasses(WithMarker(m => m.Name = new string('a', 48)));
        AssertRejectedAt(WithMarker(m => m.Name = new string('a', 49)), "Body.Rows[0].Subtunes[0].Markers[0].Name");
        AssertRejectedAt(WithMarker(m => m.Name = "  "), "Body.Rows[0].Subtunes[0].Markers[0].Name");
        AssertRejectedAt(WithMarker(m => m.Name = "a\u0000b"), "Body.Rows[0].Subtunes[0].Markers[0].Name");
    }

    [Fact]
    public void Boundaries_AreBounded()
    {
        AssertPasses(WithMarker(m => m.Start = new DjLoopBoundaryDto { Frame = 0, OffsetFrames = -1_000_000 }));
        AssertPasses(WithMarker(m => m.End = new DjLoopBoundaryDto { Frame = 5, OffsetFrames = 1_000_000 }));
        AssertRejectedAt(WithMarker(m => m.Start.Frame = -1), "Body.Rows[0].Subtunes[0].Markers[0].Start.Frame");
        AssertRejectedAt(WithMarker(m => m.Start.OffsetFrames = -1_000_001), "Body.Rows[0].Subtunes[0].Markers[0].Start.OffsetFrames");
        AssertRejectedAt(WithMarker(m => m.End!.OffsetFrames = 1_000_001), "Body.Rows[0].Subtunes[0].Markers[0].End.OffsetFrames");
    }

    [Fact]
    public void Voices_AreOneToThreeDistinctValuesInZeroToTwo()
    {
        AssertPasses(WithMarker(m => m.Voices = [2]));
        AssertRejectedAt(WithMarker(m => m.Voices = []), "Body.Rows[0].Subtunes[0].Markers[0].Voices");
        AssertRejectedAt(WithMarker(m => m.Voices = [0, 1, 2, 0]), "Body.Rows[0].Subtunes[0].Markers[0].Voices");
        AssertRejectedAt(WithMarker(m => m.Voices = [3]), "Body.Rows[0].Subtunes[0].Markers[0].Voices");
        AssertRejectedAt(WithMarker(m => m.Voices = [-1]), "Body.Rows[0].Subtunes[0].Markers[0].Voices");
        AssertRejectedAt(WithMarker(m => m.Voices = [1, 1]), "Body.Rows[0].Subtunes[0].Markers[0].Voices");
    }

    [Fact]
    public void OpaqueValues_AreBoundedTo8192Characters()
    {
        // {"a":"<n x>"} is n + 8 characters of raw text.
        static JsonElement OfLength(int length) => Opaque("{\"a\":\"" + new string('x', length - 8) + "\"}");

        AssertPasses(WithRow(row => row.Host = OfLength(8192)));
        AssertRejectedAt(WithRow(row => row.Host = OfLength(8193)), "Body.Rows[0].Host");
        AssertRejectedAt(WithRow(row => row.Subtunes[0].Settings = OfLength(8193)), "Body.Rows[0].Subtunes[0].Settings");
        AssertRejectedAt(WithMarker(m => m.Settings = OfLength(8193)), "Body.Rows[0].Subtunes[0].Markers[0].Settings");
    }
}
