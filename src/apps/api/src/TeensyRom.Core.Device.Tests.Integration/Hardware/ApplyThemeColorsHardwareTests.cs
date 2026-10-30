using TeensyRom.Core.Serial.Commands.Composite.ApplyThemeColors;
using TeensyRom.Core.Themes;

namespace TeensyRom.Core.Device.Tests.Integration;

/// <summary>
/// Applies a shipped palette and then the factory one to the bench device through the real handler, which
/// resets the C64 menu after the colors. With no hardware attached the test reports skipped.
/// </summary>
[Collection(HardwareCollection.Name)]
public class ApplyThemeColorsHardwareTests(HardwareFixture fixture)
{
    private static readonly DeviceThemePart Cga = new()
    {
        Background = 0, Border = 11, Banner = 5, Time = 1, Option = 10, Sources = 2, Name = 7
    };

    [SkippableFact]
    public async Task ApplyThemeColors_CgaThenFactory_BothSucceed()
    {
        var device = GivenDevice();
        var handler = new ApplyThemeColorsHandler(fixture.Log, fixture.Options, fixture.Manager);

        var cga = await handler.Handle(CommandFor(device, Cga), CancellationToken.None);
        var factory = await handler.Handle(CommandFor(device, ThemeDefaults.FactoryColors), CancellationToken.None);

        cga.IsSuccess.Should().BeTrue(cga.Error);
        factory.IsSuccess.Should().BeTrue(factory.Error);
    }

    private static ApplyThemeColorsCommand CommandFor(TeensyRomDevice device, DeviceThemePart colors) => new()
    {
        DeviceId = device.DeviceId,
        CommunicationPort = device.CommunicationPort,
        Colors = colors
    };

    private TeensyRomDevice GivenDevice()
    {
        Skip.If(!fixture.HasHardware, "no TeensyROM attached");
        var device = fixture.Device;
        Skip.If(device is null, $"no device confirmed on {fixture.Transport}");
        return device!;
    }
}
