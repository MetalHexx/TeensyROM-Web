using TeensyRom.Api.Endpoints.DjLibrary;
using TeensyRom.Api.Endpoints.DjLibrary.DeleteDjSet;
using TeensyRom.Api.Endpoints.DjLibrary.GetDjSet;
using TeensyRom.Api.Endpoints.DjLibrary.GetTuneMemory;
using TeensyRom.Api.Endpoints.DjLibrary.SaveDjLibraryState;

namespace TeensyRom.Api.Tests.Unit.Endpoints.DjLibrary;

public class DjLibraryRouteValidatorTests
{
    private const string SetId = "6f1c2b0e-8d1a-4c7e-9a43-2a1b7c9d0e11";

    public static TheoryData<string> BadSetIds => new()
    {
        "",
        "../evil",
        "6F1C2B0E-8D1A-4C7E-9A43-2A1B7C9D0E11",
        "6f1c2b0e8d1a4c7e9a432a1b7c9d0e11",
        "{6f1c2b0e-8d1a-4c7e-9a43-2a1b7c9d0e11}"
    };

    [Fact]
    public void GetSetAndDeleteSet_AcceptACanonicalSetId()
    {
        new GetDjSetRequestValidator().Validate(new GetDjSetRequest { SetId = SetId }).IsValid.Should().BeTrue();
        new DeleteDjSetRequestValidator().Validate(new DeleteDjSetRequest { SetId = SetId }).IsValid.Should().BeTrue();
    }

    [Theory]
    [MemberData(nameof(BadSetIds))]
    public void GetSetAndDeleteSet_RejectABadSetId(string setId)
    {
        new GetDjSetRequestValidator().Validate(new GetDjSetRequest { SetId = setId })
            .Errors.Should().Contain(e => e.PropertyName == "SetId");
        new DeleteDjSetRequestValidator().Validate(new DeleteDjSetRequest { SetId = setId })
            .Errors.Should().Contain(e => e.PropertyName == "SetId");
    }

    [Theory]
    [InlineData("0123456789abcdef0123456789abcdef", true)]
    [InlineData("0123456789abcdef0123456789abcde", false)]
    [InlineData("0123456789abcdef0123456789abcdef0", false)]
    [InlineData("0123456789ABCDEF0123456789ABCDEF", false)]
    [InlineData("../0123456789abcdef0123456789abc", false)]
    [InlineData("0123456789abcdef0123456789abcdef\n", false)]
    public void GetTuneMemory_RequiresA32CharacterLowercaseHexSidHash(string sidHash, bool valid)
    {
        var result = new GetTuneMemoryRequestValidator().Validate(new GetTuneMemoryRequest { SidHash = sidHash });

        result.IsValid.Should().Be(valid);
        if (!valid) result.Errors.Should().Contain(e => e.PropertyName == "SidHash");
    }

    [Theory]
    [InlineData(null, true)]
    [InlineData(SetId, true)]
    [InlineData("not-a-set", false)]
    [InlineData("6F1C2B0E-8D1A-4C7E-9A43-2A1B7C9D0E11", false)]
    [InlineData("", false)]
    public void SaveLibraryState_RequiresNullOrACanonicalSetId(string? currentSetId, bool valid)
    {
        var request = new SaveDjLibraryStateRequest { Body = new DjLibraryStateDto { CurrentSetId = currentSetId } };

        var result = new SaveDjLibraryStateRequestValidator().Validate(request);

        result.IsValid.Should().Be(valid);
        if (!valid) result.Errors.Should().Contain(e => e.PropertyName == "Body.CurrentSetId");
    }

    [Fact]
    public void SaveLibraryState_RejectsAMissingBody()
    {
        var result = new SaveDjLibraryStateRequestValidator().Validate(new SaveDjLibraryStateRequest { Body = null! });

        result.Errors.Should().Contain(e => e.PropertyName == "Body");
    }
}
