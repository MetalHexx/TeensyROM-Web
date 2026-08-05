using TeensyRom.Api.Endpoints.Transfers.GetActiveJob;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Transfers;

public class GetActiveJobRequestValidatorTests
{
    private readonly GetActiveJobRequestValidator _validator = new();

    [Fact]
    public void Validate_ValidDeviceId_HasNoErrors()
    {
        var result = _validator.Validate(new GetActiveJobRequest { DeviceId = "ABCD2345" });

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("!!not-a-hash!!")]
    public void Validate_InvalidDeviceId_FailsWithDeviceIdError(string deviceId)
    {
        var result = _validator.Validate(new GetActiveJobRequest { DeviceId = deviceId });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(GetActiveJobRequest.DeviceId));
    }
}
