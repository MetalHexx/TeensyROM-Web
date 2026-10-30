using TeensyRom.Api.Endpoints.Themes;
using TeensyRom.Api.Endpoints.Themes.ApplyDeviceTheme;
using TeensyRom.Api.Endpoints.Themes.CreateTheme;
using TeensyRom.Api.Endpoints.Themes.DeleteTheme;
using TeensyRom.Api.Endpoints.Themes.GetDeviceTheme;
using TeensyRom.Api.Endpoints.Themes.GetTheme;
using TeensyRom.Api.Endpoints.Themes.UpdateTheme;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Themes;

public class ThemeValidatorTests
{
    [Theory]
    [InlineData("mine", true)]
    [InlineData("a-b-2", true)]
    [InlineData("", false)]
    [InlineData("../x", false)]
    [InlineData("UPPER", false)]
    [InlineData("a--b", false)]
    [InlineData("-a", false)]
    public void ThemeId_FollowsTheIdRule_OnEveryRouteRequest(string themeId, bool expectedValid)
    {
        new GetThemeRequestValidator().Validate(new GetThemeRequest { ThemeId = themeId }).IsValid.Should().Be(expectedValid);
        new DeleteThemeRequestValidator().Validate(new DeleteThemeRequest { ThemeId = themeId }).IsValid.Should().Be(expectedValid);
        new UpdateThemeRequestValidator().Validate(new UpdateThemeRequest { ThemeId = themeId, Body = ThemeTestData.Body() })
            .IsValid.Should().Be(expectedValid);
    }

    [Theory]
    [InlineData("Kitchen", true)]
    [InlineData("123456789012345678901234", true)]
    [InlineData("1234567890123456789012345", false)]
    [InlineData("  ", false)]
    [InlineData("bad\nname", false)]
    public void Name_FollowsTheSharedNameRule(string name, bool expectedValid)
    {
        new CreateThemeRequestValidator().Validate(new CreateThemeRequest { Body = ThemeTestData.Body(name) })
            .IsValid.Should().Be(expectedValid);
    }

    [Theory]
    [InlineData(-1, false)]
    [InlineData(0, true)]
    [InlineData(15, true)]
    [InlineData(16, false)]
    public void Colors_MustBeFirmwareIndexes(int color, bool expectedValid)
    {
        new DeviceThemePartDtoValidator().Validate(ThemeTestData.ColorsDto() with { Name = color }).IsValid.Should().Be(expectedValid);
        new CreateThemeRequestValidator().Validate(new CreateThemeRequest { Body = ThemeTestData.Body(color: color) })
            .IsValid.Should().Be(expectedValid);
        new ApplyDeviceThemeRequestValidator().Validate(
            new ApplyDeviceThemeRequest { DeviceId = "ABCD2345", Body = new() { Colors = ThemeTestData.ColorsDto(color) } })
            .IsValid.Should().Be(expectedValid);
    }

    [Theory]
    [InlineData(null, true)]
    [InlineData("mine", true)]
    [InlineData("../x", false)]
    [InlineData("UPPER", false)]
    public void Apply_ThemeIdWhenPresent_MustBeAValidId(string? themeId, bool expectedValid)
    {
        new ApplyDeviceThemeRequestValidator().Validate(new ApplyDeviceThemeRequest
        {
            DeviceId = "ABCD2345",
            Body = new() { Colors = ThemeTestData.ColorsDto(), ThemeId = themeId }
        }).IsValid.Should().Be(expectedValid);
    }

    [Theory]
    [InlineData("ABCD2345", true)]
    [InlineData("", false)]
    [InlineData("bad id!", false)]
    public void DeviceId_FollowsTheDeviceIdRule(string deviceId, bool expectedValid)
    {
        new GetDeviceThemeRequestValidator().Validate(new GetDeviceThemeRequest { DeviceId = deviceId }).IsValid.Should().Be(expectedValid);
        new ApplyDeviceThemeRequestValidator().Validate(
            new ApplyDeviceThemeRequest { DeviceId = deviceId, Body = new() { Colors = ThemeTestData.ColorsDto() } })
            .IsValid.Should().Be(expectedValid);
    }
}
