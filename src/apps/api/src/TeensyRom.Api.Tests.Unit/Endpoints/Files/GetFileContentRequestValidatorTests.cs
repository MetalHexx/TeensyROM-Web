using TeensyRom.Api.Endpoints.Files.GetFileContent;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Files;

public class GetFileContentRequestValidatorTests
{
    private readonly GetFileContentRequestValidator _validator = new();

    private static GetFileContentRequest ValidRequest() => new()
    {
        DeviceId = "ABCD2345",
        StorageType = TeensyStorageType.SD,
        Path = "/music/tune.sid"
    };

    [Fact]
    public void Validate_ValidRequest_HasNoErrors()
    {
        var result = _validator.Validate(ValidRequest());

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_InvalidDeviceId_FailsWithDeviceIdError()
    {
        var request = ValidRequest();
        request.DeviceId = "not-a-hash";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(GetFileContentRequest.DeviceId) &&
            e.ErrorMessage == "Device ID must be a valid filename-safe hash of 8 characters long.");
    }

    [Fact]
    public void Validate_RootPath_FailsWithPathError()
    {
        var request = ValidRequest();
        request.Path = "/";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(GetFileContentRequest.Path) &&
            e.ErrorMessage == "Path must be a valid Unix-style file path.");
    }

    [Fact]
    public void Validate_PathWithDotDotSegment_FailsWithDotDotSegmentError()
    {
        var request = ValidRequest();
        request.Path = "/a/../b.sid";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(GetFileContentRequest.Path) &&
            e.ErrorMessage == "Path must not contain '..' segments.");
    }

    [Fact]
    public void Validate_EmptyPath_FailsWithPathRequiredError()
    {
        var request = ValidRequest();
        request.Path = "";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(GetFileContentRequest.Path) &&
            e.ErrorMessage == "Path is required.");
    }

    [Fact]
    public void Validate_UnknownStorageType_FailsWithStorageTypeError()
    {
        var request = ValidRequest();
        request.StorageType = (TeensyStorageType)999;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(GetFileContentRequest.StorageType) &&
            e.ErrorMessage == "Storage type must be a valid enum value.");
    }
}
