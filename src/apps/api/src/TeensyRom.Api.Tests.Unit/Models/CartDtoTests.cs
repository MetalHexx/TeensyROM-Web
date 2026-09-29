using TeensyRom.Api.Models;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Api.Tests.Unit.Models;

public class CartDtoTests
{
    private readonly IDeviceSettingsProvider _settingsProvider = Substitute.For<IDeviceSettingsProvider>();

    private static TeensyRomDevice CreateDevice(DeviceMode mode)
    {
        var cart = new Cart { DeviceId = "ABCD1234", IsCompatible = true };
        var port = Substitute.For<ICommunicationPort>();
        port.GetConnectionType().Returns(ConnectionType.Serial);
        port.GetEndpoint().Returns("COM5");

        var connection = new DeviceConnectionRecord(cart.DeviceId);

        if (mode == DeviceMode.FullBusy)
        {
            connection.Confirm(ConnectionType.Serial, "COM5", DeviceMode.FullIdle);
            connection.MarkBusy();
        }
        else if (mode != DeviceMode.Unreachable)
        {
            connection.Confirm(ConnectionType.Serial, "COM5", mode);
        }

        return new TeensyRomDevice(cart, port, Substitute.For<IStorageService>(), Substitute.For<IStorageService>(), connection);
    }

    [Theory]
    [InlineData(DeviceMode.FullIdle, true)]
    [InlineData(DeviceMode.FullBusy, true)]
    [InlineData(DeviceMode.Minimal, true)]
    [InlineData(DeviceMode.Unreachable, false)]
    public async Task FromDevice_SetsIsConnected_PerConnectionMode(DeviceMode mode, bool expected)
    {
        var device = CreateDevice(mode);

        var dto = await CartDto.FromDevice(device, _settingsProvider);

        dto.IsConnected.Should().Be(expected);
    }
}
