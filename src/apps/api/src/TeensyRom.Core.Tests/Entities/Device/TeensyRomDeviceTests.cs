using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Core.Tests.Entities.Device;

/// <summary>
/// Unit tests for <see cref="TeensyRomDevice"/>'s four-argument constructor, which builds a
/// device the old way (cart + port + storages) and must default <see cref="TeensyRomDevice.Connection"/>
/// to a confirmed, full-idle record on the port's own transport and endpoint.
/// </summary>
public class TeensyRomDeviceTests
{
    [Fact]
    public void Constructor_FourArg_DefaultsConnectionToFullIdleOnThePortsTransportAndEndpoint()
    {
        var mockComm = Substitute.For<ICommunicationPort>();
        mockComm.GetEndpoint().Returns("COM7");
        mockComm.GetConnectionType().Returns(ConnectionType.Serial);

        var cart = new Cart
        {
            DeviceId = "chip-1",
            Name = "Test Device"
        };

        var device = new TeensyRomDevice(
            cart,
            mockComm,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        device.Connection.Should().NotBeNull();
        device.Connection.ChipId.Should().Be("chip-1");
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        device.Connection.TransportInUse.Should().Be(ConnectionType.Serial);
        device.Connection.SerialPortName.Should().Be("COM7");
        device.Connection.LastConfirmedUtc.Should().NotBeNull();
    }

    [Fact]
    public void Constructor_FourArg_OnTcpPort_DefaultsConnectionToFullIdleOnTcpEndpoint()
    {
        var mockComm = Substitute.For<ICommunicationPort>();
        mockComm.GetEndpoint().Returns("192.168.1.42:8080");
        mockComm.GetConnectionType().Returns(ConnectionType.Tcp);

        var cart = new Cart
        {
            DeviceId = "chip-2",
            Name = "Test Device"
        };

        var device = new TeensyRomDevice(
            cart,
            mockComm,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        device.Connection.TransportInUse.Should().Be(ConnectionType.Tcp);
        device.Connection.TcpEndpoint.Should().Be("192.168.1.42:8080");
    }
}
