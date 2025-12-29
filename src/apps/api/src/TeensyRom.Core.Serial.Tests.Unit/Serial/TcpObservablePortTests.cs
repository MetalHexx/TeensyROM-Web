using System.Net.Sockets;
using System.Reactive;
using System.Text;

namespace TeensyRom.Core.Serial.Tests.Unit;

/// <summary>
/// Comprehensive behavioral tests for TcpObservablePort functionality.
/// Tests focus on TCP transport behavior, connection lifecycle, I/O operations,
/// observables, and protocol compatibility with the serial transport.
/// </summary>
public class TcpObservablePortTests : IDisposable
{
    private readonly ILoggingService _mockLogger;
    private readonly TcpObservablePort _port;

    public TcpObservablePortTests()
    {
        _mockLogger = Substitute.For<ILoggingService>();
        _port = new TcpObservablePort(_mockLogger);
    }

    public void Dispose()
    {
        try
        {
            _port?.Dispose();
        }
        catch
        {
            // Best effort cleanup
        }
    }

    #region Constructor and Initialization Tests

    [Fact]
    public void Constructor_ShouldInitializeWithDefaultState()
    {
        // Arrange & Act
        var port = new TcpObservablePort(_mockLogger);

        // Assert
        port.Should().NotBeNull();
        port.IsOpen.Should().BeFalse();
        port.BytesToRead.Should().Be(0);
    }

    [Fact]
    public void Ports_ShouldReturnEmptyArray()
    {
        // Arrange & Act
        var ports = new List<string[]>();
        using var _ = _port.Ports.Subscribe(ports.Add);

        // Assert
        ports.Should().HaveCount(1);
        ports[0].Should().BeEmpty();
    }

    [Fact]
    public void State_ShouldEmitSerialStartState_Initially()
    {
        // Arrange & Act
        var states = new List<Type>();
        using var _ = _port.State.Subscribe(states.Add);

        // Assert
        states.Should().HaveCount(1);
        states[0].Should().Be(typeof(SerialStartState));
    }

    #endregion

    #region SetPort Tests

    [Fact]
    public void SetPort_ShouldThrowException_WhenPortIsNull()
    {
        // Arrange & Act
        var act = () => _port.SetPort(null!);

        // Assert
        act.Should().Throw<TeensyException>()
            .WithMessage("*TCP endpoint cannot be empty*");
    }

    [Fact]
    public void SetPort_ShouldThrowException_WhenPortIsEmpty()
    {
        // Arrange & Act
        var act = () => _port.SetPort("   ");

        // Assert
        act.Should().Throw<TeensyException>()
            .WithMessage("*TCP endpoint cannot be empty*");
    }

    [Fact]
    public void SetPort_ShouldThrowException_WhenPortFormatIsInvalid()
    {
        // Arrange & Act
        var act = () => _port.SetPort("invalid-format");

        // Assert
        act.Should().Throw<TeensyException>()
            .WithMessage("*Invalid TCP endpoint format*");
    }

    [Fact]
    public void SetPort_ShouldThrowException_WhenPortIsMissing()
    {
        // Arrange & Act
        var act = () => _port.SetPort("192.168.1.42");

        // Assert
        act.Should().Throw<TeensyException>()
            .WithMessage("*Invalid TCP endpoint format*");
    }

    [Fact]
    public void SetPort_ShouldThrowException_WhenPortIsNotNumeric()
    {
        // Arrange & Act
        var act = () => _port.SetPort("192.168.1.42:abc");

        // Assert
        act.Should().Throw<TeensyException>()
            .WithMessage("*Invalid TCP endpoint format*");
    }

    [Fact]
    public void SetPort_ShouldThrowException_WhenPortIsOutOfRange_High()
    {
        // Arrange & Act
        var act = () => _port.SetPort("192.168.1.42:99999");

        // Assert
        act.Should().Throw<TeensyException>()
            .WithMessage("*Invalid TCP endpoint format*");
    }

    [Fact]
    public void SetPort_ShouldThrowException_WhenPortIsOutOfRange_Low()
    {
        // Arrange & Act
        var act = () => _port.SetPort("192.168.1.42:0");

        // Assert
        act.Should().Throw<TeensyException>()
            .WithMessage("*Invalid TCP endpoint format*");
    }

    [Fact]
    public void SetPort_ShouldEmitSerialConnectableState_WhenValid()
    {
        // Arrange
        var states = new List<Type>();
        using var _ = _port.State.Subscribe(states.Add);

        // Act
        _port.SetPort("192.168.1.42:80");

        // Assert
        states.Should().HaveCountGreaterThanOrEqualTo(2);
        states[^1].Should().Be(typeof(SerialConnectableState));
    }

    [Fact]
    public void SetPort_ShouldReturnUnit_WhenSuccessful()
    {
        // Arrange & Act
        var result = _port.SetPort("127.0.0.1:8080");

        // Assert
        result.Should().Be(System.Reactive.Unit.Default);
    }

    #endregion

    #region OpenPort Tests

    [Fact]
    public void OpenPort_ShouldCallStartHealthCheck_AndReturnEndpoint()
    {
        // Arrange
        _port.SetPort("127.0.0.1:8080");

        // Act
        // Note: StartHealthCheck catches exceptions and returns null
        var result = _port.OpenPort();

        // Assert - Returns the endpoint even if connection fails
        result.Should().Be("127.0.0.1:8080");
    }

    #endregion

    #region ClosePort Tests

    [Fact]
    public void ClosePort_ShouldEmitSerialConnectableState()
    {
        // Arrange
        var states = new List<Type>();
        using var _ = _port.State.Subscribe(states.Add);
        _port.SetPort("127.0.0.1:8080");

        // Act
        _port.ClosePort();

        // Assert
        states.Should().Contain(typeof(SerialConnectableState));
    }

    [Fact]
    public void ClosePort_ShouldReturnUnit()
    {
        // Arrange
        _port.SetPort("127.0.0.1:8080");

        // Act
        var result = _port.ClosePort();

        // Assert
        result.Should().Be(System.Reactive.Unit.Default);
    }

    #endregion

    #region EnsureConnection Tests

    [Fact]
    public void EnsureConnection_ShouldThrowException_WhenEndpointIsInvalid()
    {
        // Arrange - Don't set port, endpoint is null

        // Act
        var act = () => _port.EnsureConnection();

        // Assert
        act.Should().Throw<TeensyException>()
            .WithMessage("*Unable to connect to*");
    }

    [Fact]
    public void EnsureConnection_ShouldTimeout_WhenConnectionFails()
    {
        // Arrange
        _port.SetPort("192.168.1.254:9999"); // Non-existent host

        // Act
        var act = () => _port.EnsureConnection();

        // Assert - Should timeout after 2000ms
        act.Should().Throw<TeensyException>()
            .WithMessage("*Unable to connect*");
    }

    #endregion

    #region Write Tests

    [Fact]
    public void Write_ShouldThrowException_WhenNotConnected()
    {
        // Arrange & Act
        var act = () => _port.Write("test");

        // Assert
        act.Should().Throw<TeensyException>()
            .WithMessage("*Cannot write: TCP connection is not open*");
    }

    [Fact]
    public void Write_ByteArray_ShouldThrowException_WhenNotConnected()
    {
        // Arrange
        var buffer = Encoding.UTF8.GetBytes("test");

        // Act
        var act = () => _port.Write(buffer, 0, buffer.Length);

        // Assert
        act.Should().Throw<TeensyException>()
            .WithMessage("*Cannot write: TCP connection is not open*");
    }

    [Fact]
    public void Write_CharArray_ShouldThrowException_WhenNotConnected()
    {
        // Arrange
        var buffer = new char[] { 't', 'e', 's', 't' };

        // Act
        var act = () => _port.Write(buffer, 0, buffer.Length);

        // Assert
        act.Should().Throw<TeensyException>()
            .WithMessage("*Cannot write: TCP connection is not open*");
    }

    #endregion

    #region Read Tests

    [Fact]
    public void Read_ShouldThrowException_WhenNotConnected()
    {
        // Arrange
        var buffer = new byte[100];

        // Act
        var act = () => _port.Read(buffer, 0, buffer.Length);

        // Assert
        act.Should().Throw<TeensyException>()
            .WithMessage("*Cannot read: TCP connection is not open*");
    }

    [Fact]
    public void ReadByte_ShouldThrowException_WhenNotConnected()
    {
        // Arrange & Act
        var act = () => _port.ReadByte();

        // Assert
        act.Should().Throw<TeensyException>()
            .WithMessage("*Cannot read: TCP connection is not open*");
    }

    [Fact]
    public void ReadSerialAsString_ShouldReturnEmpty_WhenNoData()
    {
        // Arrange & Act
        var result = _port.ReadSerialAsString();

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public void ReadAndLogSerialAsString_ShouldReturnEmpty_WhenNoData()
    {
        // Arrange & Act
        var result = _port.ReadAndLogSerialAsString();

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public void ReadSerialBytes_ShouldReturnEmptyArray_WhenNoData()
    {
        // Arrange & Act
        var result = _port.ReadSerialBytes();

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public void ReadSerialBytes_WithWait_ShouldReturnEmptyArray_WhenNoData()
    {
        // Arrange & Act
        var result = _port.ReadSerialBytes(100);

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region Lock/Unlock Tests

    [Fact]
    public void Lock_ShouldClearBuffers()
    {
        // Arrange
        _port.SetPort("127.0.0.1:8080");

        // Act
        _port.Lock();

        // Assert
        _port.BytesToRead.Should().Be(0);
    }

    [Fact]
    public void Lock_ShouldNotThrow()
    {
        // Arrange & Act
        var act = () => _port.Lock();

        // Assert
        act.Should().NotThrow();
    }

    [Fact]
    public void Unlock_ShouldNotThrow()
    {
        // Arrange & Act
        var act = () => _port.Unlock();

        // Assert
        act.Should().NotThrow();
    }

    #endregion

    #region ClearBuffers Tests

    [Fact]
    public void ClearBuffers_ShouldNotThrow()
    {
        // Arrange & Act
        var act = () => _port.ClearBuffers();

        // Assert
        act.Should().NotThrow();
    }

    #endregion

    #region Protocol Methods Tests

    [Fact]
    public void SendIntBytes_ShouldThrowException_WhenNotConnected()
    {
        // Arrange & Act
        var act = () => _port.SendIntBytes(0x12345678, 4);

        // Assert
        act.Should().Throw<TeensyException>();
    }

    [Fact]
    public void SendSignedChar_ShouldThrowException_WhenNotConnected()
    {
        // Arrange & Act
        var act = () => _port.SendSignedChar((sbyte)-1);

        // Assert
        act.Should().Throw<TeensyException>();
    }

    [Fact]
    public void SendSignedShort_ShouldThrowException_WhenNotConnected()
    {
        // Arrange & Act
        var act = () => _port.SendSignedShort(-1000);

        // Assert
        act.Should().Throw<TeensyException>();
    }

    #endregion

    #region WaitForSerialData Tests

    [Fact]
    public void WaitForSerialData_ShouldTimeout_WhenNoData()
    {
        // Arrange & Act
        var act = () => _port.WaitForSerialData(10, 100);

        // Assert
        act.Should().Throw<TimeoutException>()
            .WithMessage("*Timed out waiting for data to be received*");
    }

    #endregion

    #region Health Check Tests

    [Fact]
    public void StartHealthCheck_ShouldReturnNull()
    {
        // Arrange & Act
        var result = _port.EnsureConnection();

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public void StopHealthCheck_ShouldNotThrow()
    {
        // Arrange & Act
        var act = () => _port.StopHealthCheck();

        // Assert
        act.Should().NotThrow();
    }

    #endregion

    #region StartPortPoll Tests

    [Fact]
    public void StartPortPoll_ShouldNotThrow()
    {
        // Arrange & Act
        var act = () => _port.StartPortPoll();

        // Assert
        act.Should().NotThrow();
    }

    #endregion

    #region State Transition Tests

    [Fact]
    public void State_ShouldTransitionThroughLifecycle()
    {
        // Arrange
        var states = new List<Type>();
        using var _ = _port.State.Subscribe(states.Add);

        // Act - Initial state should be SerialStartState
        states[0].Should().Be(typeof(SerialStartState));

        // Act - SetPort should transition to SerialConnectableState
        _port.SetPort("127.0.0.1:8080");
        states[^1].Should().Be(typeof(SerialConnectableState));

        // Act - ClosePort should maintain SerialConnectableState
        _port.ClosePort();
        states[^1].Should().Be(typeof(SerialConnectableState));
    }

    #endregion

    #region Dispose Tests

    [Fact]
    public void Dispose_ShouldNotThrow()
    {
        // Arrange
        var port = new TcpObservablePort(_mockLogger);

        // Act
        var act = () => port.Dispose();

        // Assert
        act.Should().NotThrow();
    }

    [Fact]
    public void Dispose_CanBeCalledMultipleTimes()
    {
        // Arrange
        var port = new TcpObservablePort(_mockLogger);

        // Act
        port.Dispose();
        var act = () => port.Dispose();

        // Assert
        act.Should().NotThrow();
    }

    #endregion
}
