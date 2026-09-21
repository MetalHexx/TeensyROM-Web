using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Core.Tests.Entities.Device;

/// <summary>
/// Unit tests for <see cref="DeviceConnectionRecord"/> covering the confirm/busy/idle/unreachable
/// transitions and the argument guard on <see cref="DeviceConnectionRecord.Confirm"/>.
/// </summary>
public class DeviceConnectionRecordTests
{
    [Fact]
    public void Constructor_SetsChipId_AndDefaultsToUnreachable()
    {
        var sut = new DeviceConnectionRecord("chip-1");

        sut.ChipId.Should().Be("chip-1");
        sut.Mode.Should().Be(DeviceMode.Unreachable);
        sut.TransportInUse.Should().BeNull();
        sut.SerialPortName.Should().BeNull();
        sut.TcpEndpoint.Should().BeNull();
        sut.LastConfirmedUtc.Should().BeNull();
    }

    [Fact]
    public void Confirm_OnSerial_SetsSerialEndpoint_TransportInUse_Mode_AndLastConfirmed()
    {
        var sut = new DeviceConnectionRecord("chip-1");

        sut.Confirm(ConnectionType.Serial, "COM12", DeviceMode.FullIdle);

        sut.SerialPortName.Should().Be("COM12");
        sut.TransportInUse.Should().Be(ConnectionType.Serial);
        sut.Mode.Should().Be(DeviceMode.FullIdle);
        sut.LastConfirmedUtc.Should().NotBeNull();
        sut.LastConfirmedUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Confirm_OnSerialThenTcp_KeepsBothEndpoints_AndReportsTcpInUse()
    {
        var sut = new DeviceConnectionRecord("chip-1");

        sut.Confirm(ConnectionType.Serial, "COM12", DeviceMode.FullIdle);
        sut.Confirm(ConnectionType.Tcp, "192.168.1.37:2112", DeviceMode.FullIdle);

        sut.SerialPortName.Should().Be("COM12");
        sut.TcpEndpoint.Should().Be("192.168.1.37:2112");
        sut.TransportInUse.Should().Be(ConnectionType.Tcp);
    }

    [Fact]
    public void Confirm_WithMinimalMode_SetsMinimalMode()
    {
        var sut = new DeviceConnectionRecord("chip-1");

        sut.Confirm(ConnectionType.Tcp, "192.168.1.37:2112", DeviceMode.Minimal);

        sut.Mode.Should().Be(DeviceMode.Minimal);
    }

    [Theory]
    [InlineData(DeviceMode.Unreachable)]
    [InlineData(DeviceMode.FullBusy)]
    public void Confirm_WithUnreachableOrBusyMode_Throws(DeviceMode mode)
    {
        var sut = new DeviceConnectionRecord("chip-1");

        var act = () => sut.Confirm(ConnectionType.Serial, "COM12", mode);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void MarkBusy_SetsModeOnly()
    {
        var sut = new DeviceConnectionRecord("chip-1");
        sut.Confirm(ConnectionType.Serial, "COM12", DeviceMode.FullIdle);
        var confirmedAt = sut.LastConfirmedUtc;

        sut.MarkBusy();

        sut.Mode.Should().Be(DeviceMode.FullBusy);
        sut.TransportInUse.Should().Be(ConnectionType.Serial);
        sut.SerialPortName.Should().Be("COM12");
        sut.LastConfirmedUtc.Should().Be(confirmedAt);
    }

    [Fact]
    public void MarkIdle_SetsModeToFullIdle()
    {
        var sut = new DeviceConnectionRecord("chip-1");
        sut.Confirm(ConnectionType.Serial, "COM12", DeviceMode.FullIdle);
        sut.MarkBusy();

        sut.MarkIdle();

        sut.Mode.Should().Be(DeviceMode.FullIdle);
    }

    [Fact]
    public void MarkUnreachable_ClearsTransportInUse_ButKeepsEndpointsAndLastConfirmed()
    {
        var sut = new DeviceConnectionRecord("chip-1");
        sut.Confirm(ConnectionType.Serial, "COM12", DeviceMode.FullIdle);
        sut.Confirm(ConnectionType.Tcp, "192.168.1.37:2112", DeviceMode.FullIdle);
        var confirmedAt = sut.LastConfirmedUtc;

        sut.MarkUnreachable();

        sut.Mode.Should().Be(DeviceMode.Unreachable);
        sut.TransportInUse.Should().BeNull();
        sut.SerialPortName.Should().Be("COM12");
        sut.TcpEndpoint.Should().Be("192.168.1.37:2112");
        sut.LastConfirmedUtc.Should().Be(confirmedAt);
    }

    [Fact]
    public void EndpointFor_ReturnsEndpointForTransport_AndNullWhenNeverSeen()
    {
        var sut = new DeviceConnectionRecord("chip-1");
        sut.Confirm(ConnectionType.Serial, "COM12", DeviceMode.FullIdle);

        sut.EndpointFor(ConnectionType.Serial).Should().Be("COM12");
        sut.EndpointFor(ConnectionType.Tcp).Should().BeNull();
    }
}
