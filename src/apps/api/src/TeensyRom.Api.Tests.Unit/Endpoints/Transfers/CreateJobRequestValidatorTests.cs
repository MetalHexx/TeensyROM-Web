using TeensyRom.Api.Endpoints.Transfers.CreateJob;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Transfers;

public class CreateJobRequestValidatorTests
{
    private readonly CreateJobRequestValidator _validator = new();

    private static CreateJobRequest ValidRequest() => new()
    {
        DeviceId = "ABCD2345",
        StorageType = TeensyStorageType.SD,
        Body = new CreateJobBody { DestinationDirectory = "/music/incoming" }
    };

    [Fact]
    public void Validate_ValidRequest_HasNoErrors()
    {
        var result = _validator.Validate(ValidRequest());

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("!!not-a-hash!!")]
    public void Validate_InvalidDeviceId_FailsWithDeviceIdError(string deviceId)
    {
        var request = ValidRequest();
        request.DeviceId = deviceId;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CreateJobRequest.DeviceId));
    }

    [Fact]
    public void Validate_InvalidStorageType_FailsWithStorageTypeError()
    {
        var request = ValidRequest();
        request.StorageType = (TeensyStorageType)999;

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CreateJobRequest.StorageType));
    }

    [Fact]
    public void Validate_EmptyDestinationDirectory_FailsWithDestinationDirectoryError()
    {
        var request = ValidRequest();
        request.Body.DestinationDirectory = "";

        var result = _validator.Validate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Body.DestinationDirectory");
    }
}
