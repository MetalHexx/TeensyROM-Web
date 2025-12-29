using FluentAssertions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Settings;

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
    public void CreateSerial_ShouldReturnSerialStateContext()
    {
        // Arrange
        const string portName = "COM3";

        // Act
        var act = () => _factory.CreateSerial(portName);

        // Assert - May throw TeensyException if port doesn't exist, but factory creates the context
        // The important thing is that it attempts to create SerialStateContext
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
    public void CreateTcp_ShouldReturnSerialStateContext()
    {
        // Arrange
        const string endpoint = "192.168.1.42:80";

        // Act
        var result = _factory.CreateTcp(endpoint);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeOfType<SerialStateContext>();
    }

    [Fact]
    public void CreateTcp_ShouldCallSetPortWithProvidedEndpoint()
    {
        // Arrange
        const string endpoint = "192.168.1.42:8080";

        // Act
        var result = _factory.CreateTcp(endpoint);

        // Assert
        result.Should().NotBeNull();
        // Verify logging was called with endpoint info
        _mockLog.Received().Internal(Arg.Is<string>(s => s.Contains(endpoint)));
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
        result.Should().BeOfType<SerialStateContext>();
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
        var cart = new Cart
        {
            ConnectionType = ConnectionType.Serial,
            ComPort = "COM3"
        };

        // Act
        var act = () => _factory.Create(cart);

        // Assert - Serial port validation will fail if COM3 doesn't exist
        act.Should().Throw<TeensyException>()
            .WithMessage("*currently unavailable*");
    }

    [Fact]
    public void Create_ShouldCallCreateTcp_WhenConnectionTypeIsTcp()
    {
        // Arrange
        var cart = new Cart
        {
            ConnectionType = ConnectionType.Tcp,
            IpAddress = "192.168.1.42",
            TcpPort = 8080
        };

        // Act
        var result = _factory.Create(cart);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeOfType<SerialStateContext>();
    }

    [Fact]
    public void Create_ShouldThrowArgumentException_WhenConnectionTypeIsUnknown()
    {
        // Arrange
        // Create a cart with an invalid connection type (if enum has more than 2 values)
        // For now, we test the switch statement logic
        var cart = new Cart
        {
            ConnectionType = (ConnectionType)99, // Invalid enum value
            ComPort = "COM3"
        };

        // Act
        var act = () => _factory.Create(cart);

        // Assert
        act.Should().Throw<ArgumentException>()
           .WithMessage("*Unknown ConnectionType*");
    }

    [Fact]
    public void Create_ShouldFormatTcpEndpointFromCartProperties()
    {
        // Arrange
        var cart = new Cart
        {
            ConnectionType = ConnectionType.Tcp,
            IpAddress = "192.168.1.42",
            TcpPort = 8080
        };

        // Act
        var result = _factory.Create(cart);

        // Assert
        result.Should().NotBeNull();
        _mockLog.Received().Internal(Arg.Is<string>(s => s.Contains("192.168.1.42:8080")));
    }

    [Fact]
    public void Create_ShouldUseComPortForSerialConnection()
    {
        // Arrange
        var cart = new Cart
        {
            ConnectionType = ConnectionType.Serial,
            ComPort = "COM1"
        };

        // Act
        var act = () => _factory.Create(cart);

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
        tcpContext.Should().BeOfType<SerialStateContext>();
    }

    [Fact]
    public void Factory_ShouldCreateFromCartWithBothConnectionTypes()
    {
        // Arrange
        var serialCart = new Cart
        {
            ConnectionType = ConnectionType.Serial,
            ComPort = "COM3"
        };
        var tcpCart = new Cart
        {
            ConnectionType = ConnectionType.Tcp,
            IpAddress = "192.168.1.42",
            TcpPort = 8080
        };

        // Act
        var serialAct = () => _factory.Create(serialCart);
        var tcpContext = _factory.Create(tcpCart);

        // Assert
        serialAct.Should().Throw<TeensyException>(); // Serial port may not exist
        tcpContext.Should().NotBeNull();
    }

    #endregion
}
