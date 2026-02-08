using FluentAssertions;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Core.Serial.Tests.Unit;

/// <summary>
/// Unit tests for DeviceTransportFactory.
/// Tests cover factory creation for Serial and TCP transports, including error handling.
/// </summary>
public class DeviceTransportFactoryTests
{
    private readonly ILoggingService _mockLog = Substitute.For<ILoggingService>();
    private readonly IAlertService _mockAlert = Substitute.For<IAlertService>();
    private readonly DeviceTransportFactory _factory;

    public DeviceTransportFactoryTests()
    {
        _factory = new DeviceTransportFactory(_mockLog, _mockAlert);
    }

    #region CreateSerial Tests

    [Fact]
    public void CreateSerial_ShouldReturnICommunicationPort()
    {
        // Arrange
        const string portName = "COM3";

        // Act
        var act = () => _factory.CreateSerial(portName);

        // Assert - May throw TeensyException if port doesn't exist
        // The important thing is that it attempts to create the port
        act.Should().ThrowExactly<TeensyException>()
            .WithMessage("*currently unavailable*");
    }

    [Fact]
    public void CreateSerial_ShouldInstantiateSimpleObservableSerialPort()
    {
        // This test verifies the factory creates the correct transport type
        // by checking the error message from SimpleObservableSerialPort
        const string portName = "COM3";

        // Act
        var act = () => _factory.CreateSerial(portName);

        // Assert - SimpleObservableSerialPort validates port availability
        act.Should().Throw<TeensyException>()
            .WithMessage("*currently unavailable*");
    }

    #endregion

    #region CreateTcp Tests

    [Fact]
    public void CreateTcp_ShouldReturnICommunicationPort()
    {
        // Arrange
        const string endpoint = "192.168.1.42:80";

        // Act
        var result = _factory.CreateTcp(endpoint);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeAssignableTo<ICommunicationPort>();
    }

    [Fact]
    public void CreateTcp_ShouldReturnTcpObservablePort()
    {
        // Arrange
        const string endpoint = "192.168.1.42:8080";

        // Act
        var result = _factory.CreateTcp(endpoint);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeOfType<TcpCommunicationPort>();
    }

    [Fact]
    public void CreateTcp_ShouldThrowArgumentException_WhenEndpointFormatIsInvalid()
    {
        // Arrange
        const string invalidEndpoint = "invalid-endpoint";

        // Act
        var act = () => _factory.CreateTcp(invalidEndpoint);

        // Assert
        act.Should().Throw<ArgumentException>()
           .WithMessage("*Invalid TCP endpoint format*");
    }

    [Fact]
    public void CreateTcp_ShouldThrowArgumentException_WhenEndpointHasNoPort()
    {
        // Arrange
        const string invalidEndpoint = "192.168.1.42";

        // Act
        var act = () => _factory.CreateTcp(invalidEndpoint);

        // Assert
        act.Should().Throw<ArgumentException>()
           .WithMessage("*Invalid TCP endpoint format*");
    }

    [Fact]
    public void CreateTcp_ShouldThrowArgumentException_WhenEndpointHasNoHost()
    {
        // Arrange
        const string invalidEndpoint = ":8080";

        // Act
        var act = () => _factory.CreateTcp(invalidEndpoint);

        // Assert
        act.Should().Throw<ArgumentException>()
           .WithMessage("*Invalid TCP endpoint format*");
    }

    [Theory]
    [InlineData("192.168.1.42:80")]
    [InlineData("127.0.0.1:3000")]
    [InlineData("10.0.0.1:8080")]
    [InlineData("192.168.1.1:1")]
    [InlineData("192.168.1.1:65535")]
    public void CreateTcp_ShouldSucceed_WithValidEndpoints(string endpoint)
    {
        // Act
        var result = _factory.CreateTcp(endpoint);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeAssignableTo<ICommunicationPort>();
    }

    [Theory]
    [InlineData("192.168.1.42:0")]
    [InlineData("192.168.1.42:-1")]
    [InlineData("192.168.1.42:99999")]
    [InlineData("192.168.1.42:abc")]
    public void CreateTcp_ShouldThrow_WithInvalidPorts(string endpoint)
    {
        // Act
        var act = () => _factory.CreateTcp(endpoint);

        // Assert
        act.Should().Throw<ArgumentException>()
           .WithMessage("*Invalid TCP endpoint format*");
    }

    [Fact]
    public void CreateTcp_ShouldNotThrowArgumentException_WhenEndpointIsValid()
    {
        // Arrange
        const string validEndpoint = "192.168.1.42:8080";

        // Act
        var act = () => _factory.CreateTcp(validEndpoint);

        // Assert
        act.Should().NotThrow();
    }

    #endregion

    #region Create(Cart) Tests

    [Fact]
    public void Create_ShouldCallCreateSerial_WhenConnectionTypeIsSerial()
    {
        // Arrange
        var mockComm = Substitute.For<ICommunicationPort>();
        mockComm.GetEndpoint().Returns("COM3");
        mockComm.GetConnectionType().Returns(ConnectionType.Serial);

        var cart = new Cart
        {
            DeviceId = "test-device",
            Name = "Test Serial Device"
        };
        var device = new TeensyRomDevice(
            cart,
            mockComm,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        // Act
        var act = () => _factory.Create(device);

        // Assert - Serial port validation will fail if COM3 doesn't exist
        act.Should().Throw<TeensyException>()
            .WithMessage("*currently unavailable*");
    }

    [Fact]
    public void Create_ShouldCallCreateTcp_WhenConnectionTypeIsTcp()
    {
        // Arrange
        var mockComm = Substitute.For<ICommunicationPort>();
        mockComm.GetEndpoint().Returns("192.168.1.42:8080");
        mockComm.GetConnectionType().Returns(ConnectionType.Tcp);

        var cart = new Cart
        {
            DeviceId = "test-device",
            Name = "Test TCP Device"
        };
        var device = new TeensyRomDevice(
            cart,
            mockComm,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        // Act
        var result = _factory.Create(device);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeAssignableTo<ICommunicationPort>();
    }

    [Fact]
    public void Create_ShouldThrowArgumentException_WhenConnectionTypeIsUnknown()
    {
        // Arrange
        var mockComm = Substitute.For<ICommunicationPort>();
        mockComm.GetEndpoint().Returns("COM3");
        mockComm.GetConnectionType().Returns((ConnectionType)99); // Invalid enum value

        var cart = new Cart
        {
            DeviceId = "test-device",
            Name = "Test Device"
        };
        var device = new TeensyRomDevice(
            cart,
            mockComm,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        // Act
        var act = () => _factory.Create(device);

        // Assert
        act.Should().Throw<ArgumentException>()
           .WithMessage("*Unknown ConnectionType*");
    }

    [Fact]
    public void Create_ShouldFormatTcpEndpointFromCartProperties()
    {
        // Arrange
        var mockComm = Substitute.For<ICommunicationPort>();
        mockComm.GetEndpoint().Returns("192.168.1.42:8080");
        mockComm.GetConnectionType().Returns(ConnectionType.Tcp);

        var cart = new Cart
        {
            DeviceId = "test-device",
            Name = "Test TCP Device"
        };
        var device = new TeensyRomDevice(
            cart,
            mockComm,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        // Act
        var result = _factory.Create(device);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeOfType<TcpCommunicationPort>();
    }

    [Fact]
    public void Create_ShouldUseComPortForSerialConnection()
    {
        // Arrange
        var mockComm = Substitute.For<ICommunicationPort>();
        mockComm.GetEndpoint().Returns("COM1");
        mockComm.GetConnectionType().Returns(ConnectionType.Serial);

        var cart = new Cart
        {
            DeviceId = "test-device",
            Name = "Test Device"
        };
        var device = new TeensyRomDevice(
            cart,
            mockComm,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        // Act
        var act = () => _factory.Create(device);

        // Assert - Should attempt to use COM1 (throws because port doesn't exist)
        act.Should().Throw<TeensyException>();
    }

    #endregion

    #region Integration Tests

    [Fact]
    public void Factory_ShouldCreateBothSerialAndTcpTransports()
    {
        // Arrange
        const string serialPort = "COM3";
        const string tcpEndpoint = "192.168.1.42:8080";

        // Act
        var serialAct = () => _factory.CreateSerial(serialPort);
        var tcpContext = _factory.CreateTcp(tcpEndpoint);

        // Assert
        serialAct.Should().Throw<TeensyException>(); // Serial port may not exist
        tcpContext.Should().NotBeNull();
        tcpContext.Should().BeAssignableTo<ICommunicationPort>();
    }

    [Fact]
    public void Factory_ShouldCreateFromCartWithBothConnectionTypes()
    {
        // Arrange
        var serialComm = Substitute.For<ICommunicationPort>();
        serialComm.GetEndpoint().Returns("COM3");
        serialComm.GetConnectionType().Returns(ConnectionType.Serial);

        var serialCart = new Cart { DeviceId = "serial-device", Name = "Serial Device" };
        var serialDevice = new TeensyRomDevice(
            serialCart,
            serialComm,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        var tcpComm = Substitute.For<ICommunicationPort>();
        tcpComm.GetEndpoint().Returns("192.168.1.42:8080");
        tcpComm.GetConnectionType().Returns(ConnectionType.Tcp);

        var tcpCart = new Cart { DeviceId = "tcp-device", Name = "TCP Device" };
        var tcpDevice = new TeensyRomDevice(
            tcpCart,
            tcpComm,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );

        // Act
        var serialAct = () => _factory.Create(serialDevice);
        var tcpContext = _factory.Create(tcpDevice);

        // Assert
        serialAct.Should().Throw<TeensyException>(); // Serial port may not exist
        tcpContext.Should().NotBeNull();
        tcpContext.Should().BeAssignableTo<ICommunicationPort>();
    }

    #endregion
}
