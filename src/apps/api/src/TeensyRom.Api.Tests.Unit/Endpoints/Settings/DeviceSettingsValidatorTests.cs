using TeensyRom.Api.Endpoints.Settings;
using TeensyRom.Api.Endpoints.Settings.SaveSettings;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Settings;

public class DeviceSettingsValidatorTests
{
    private readonly DeviceSettingsValidator _validator = new();

    private static DeviceSettingsDto DeviceWithId(string deviceId) => new()
    {
        DeviceId = deviceId,
        VideoSettings = new VideoSettingsDto()
    };

    [Theory]
    [InlineData("19307720")]
    [InlineData("Unknown")]
    [InlineData("Unknown-2")]
    [InlineData("ABCD2345")]
    public void Validate_ValidDeviceId_HasNoDeviceIdError(string deviceId)
    {
        var result = _validator.Validate(DeviceWithId(deviceId));

        result.Errors.Should().NotContain(e => e.PropertyName == nameof(DeviceSettingsDto.DeviceId));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("192.168.1.37:2112")]
    [InlineData("!!not-a-device!!")]
    public void Validate_InvalidDeviceId_FailsWithDeviceIdError(string deviceId)
    {
        var result = _validator.Validate(DeviceWithId(deviceId));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(DeviceSettingsDto.DeviceId));
    }
}
