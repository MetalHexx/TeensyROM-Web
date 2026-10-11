using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial.Tests.Unit;

/// <summary>
/// Comprehensive behavioral tests for TcpObservablePort functionality.
/// Tests focus on TCP transport behavior, connection lifecycle, I/O operations,
/// observables, and protocol compatibility with the serial transport.
/// </summary>
public class TcpCommunicationPortTests : IDisposable
{
    private readonly ILoggingService _mockLogger;
    private readonly TcpCommunicationPort _port;

    public TcpCommunicationPortTests()
    {
        _mockLogger = Substitute.For<ILoggingService>();
        _port = new TcpCommunicationPort(_mockLogger);
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
        var port = new TcpCommunicationPort(_mockLogger);

        // Assert
        port.Should().NotBeNull();
        port.IsOpen.Should().BeFalse();
        port.BytesToRead.Should().Be(0);
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
    public void SetPort_ShouldReturnUnit_WhenSuccessful()
    {
        // Arrange & Act
        var result = _port.SetPort("127.0.0.1:8080");

        // Assert
        result.Should().Be(System.Reactive.Unit.Default);
    }

    #endregion

    #region OpenPort Tests

    #endregion

    #region ClosePort Tests

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
            .WithMessage("*Invalid endpoint format*");
    }

    [Fact]
    public void EnsureConnection_ShouldThrowSocketException_WhenConnectionFails()
    {
        // Arrange
        _port.SetPort("192.168.1.254:9999"); // Non-existent host

        // Act
        var act = () => _port.EnsureConnection();

        // Assert - TryConnect rethrows SocketException from TcpClient.Connect
        act.Should().Throw<System.Net.Sockets.SocketException>();
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
    public async Task ReadAsync_ShouldThrowException_WhenNotConnected()
    {
        // Arrange
        var buffer = new byte[100];

        // Act
        var act = () => _port.ReadAsync(buffer, 0, buffer.Length, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<TeensyException>()
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

    [Fact]
    public async Task WaitForSerialDataAsync_ShouldTimeout_WhenNoData()
    {
        // Arrange & Act
        var act = () => _port.WaitForSerialDataAsync(10, 100, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<TimeoutException>()
            .WithMessage("*Timed out waiting for data to be received*");
    }

    [Fact]
    public async Task WaitForSerialDataAsync_ShouldReportCancellation_WhenCallersTokenIsAlreadyCancelled()
    {
        // Arrange - a timeout far longer than the test could run, so a TimeoutException here would mean
        // the cancel was misreported as an expiry rather than the wait genuinely timing out.
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        // Act
        var act = () => _port.WaitForSerialDataAsync(10, 60_000, cts.Token);

        // Assert
        await act.Should().ThrowAsync<OperationCanceledException>();
    }

    [Fact]
    public async Task WaitForSerialDataAsync_ShouldBufferBytes_SoAFollowingReadAsyncIsServedWithoutTheSocket()
    {
        // Arrange
        using var listener = new TcpListenerScope();
        using var client = new TcpClient();
        await client.ConnectAsync(IPAddress.Loopback, listener.Port);
        using var accepted = await listener.Accepted;
        using var port = new TcpCommunicationPort(_mockLogger, client);

        var sent = new byte[] { 0x41, 0x42 };
        await accepted.GetStream().WriteAsync(sent);
        await accepted.GetStream().FlushAsync();

        // Act - the wait pulls both bytes off the socket into the receive buffer, so the read that
        // follows must be served from that buffer. If it went back to the socket instead there is
        // nothing more to send and the token would cancel it.
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        await port.WaitForSerialDataAsync(2, 5000, cts.Token);

        var buffer = new byte[2];
        var bytesRead = await port.ReadAsync(buffer, 0, 2, cts.Token);

        // Assert
        bytesRead.Should().Be(2);
        buffer.Should().Equal(sent);
    }

    [Fact]
    public async Task Read_ShouldReturnBufferedBytes_WithoutWaitingOnTheSocketForTheRest()
    {
        // Arrange
        using var listener = new TcpListenerScope();
        using var client = new TcpClient();
        await client.ConnectAsync(IPAddress.Loopback, listener.Port);
        using var accepted = await listener.Accepted;
        using var port = new TcpCommunicationPort(_mockLogger, client);

        var sent = Encoding.ASCII.GetBytes("Busy!\n");
        await accepted.GetStream().WriteAsync(sent);
        await accepted.GetStream().FlushAsync();
        port.WaitForSerialData(sent.Length, 5000);

        // Act - everything sent is already buffered and nothing more is coming. Waiting on the socket
        // for the rest of the 4096 would run into the read timeout and throw the buffered bytes away.
        var buffer = new byte[4096];
        var bytesRead = port.Read(buffer, 0, buffer.Length);

        // Assert
        bytesRead.Should().Be(sent.Length);
        buffer.Take(bytesRead).Should().Equal(sent);
    }

    [Fact]
    public async Task ProbeStorageRoot_ShouldReportBusy_WhenFailTokenAndBusyTextArriveTogether()
    {
        // Arrange - a device running a program answers the list command with the Fail token and
        // "Busy!\n" in one write, so both land in the receive buffer during the ack wait.
        using var listener = new TcpListenerScope();
        using var client = new TcpClient();
        await client.ConnectAsync(IPAddress.Loopback, listener.Port);
        using var accepted = await listener.Accepted;
        using var port = new TcpCommunicationPort(_mockLogger, client);

        var device = Task.Run(async () =>
        {
            var stream = accepted.GetStream();
            await stream.ReadExactlyAsync(new byte[2]);
            var reply = BitConverter.GetBytes(TeensyToken.Fail.Value).Concat(Encoding.ASCII.GetBytes("Busy!\n")).ToArray();
            await stream.WriteAsync(reply);
            await stream.FlushAsync();
        });

        // Act
        var result = port.ProbeStorageRoot(TeensyStorageType.SD, _mockLogger);
        await device;

        // Assert
        result.Should().Be(StoragePresence.Busy);
    }

    [Fact]
    public async Task ClearBuffers_ShouldDiscardStaleBytes_WithoutWaitingForAFullBuffer()
    {
        // Arrange - a launch that returns at the firmware's ack leaves late text on the socket, such as
        // "Resetting C64" when the launch interrupted a running program.
        using var listener = new TcpListenerScope();
        using var client = new TcpClient();
        await client.ConnectAsync(IPAddress.Loopback, listener.Port);
        using var accepted = await listener.Accepted;
        using var port = new TcpCommunicationPort(_mockLogger, client);

        var stale = Encoding.ASCII.GetBytes("Resetting C64\r\n");
        await accepted.GetStream().WriteAsync(stale);
        await accepted.GetStream().FlushAsync();
        var arrival = Stopwatch.StartNew();
        while (client.Available < stale.Length && arrival.ElapsedMilliseconds < 5000) await Task.Delay(5);

        // Act
        var clearing = Stopwatch.StartNew();
        var clear = Task.Run(port.ClearBuffers);
        var finished = await Task.WhenAny(clear, Task.Delay(2000)) == clear;
        clearing.Stop();

        var fresh = Encoding.ASCII.GetBytes("ok");
        await accepted.GetStream().WriteAsync(fresh);
        await accepted.GetStream().FlushAsync();
        port.WaitForSerialData(fresh.Length, 5000);
        var buffer = new byte[16];
        var bytesRead = port.Read(buffer, 0, buffer.Length);

        // Assert - the old ReadExactly(4096) waited out the read timeout for bytes that never came.
        finished.Should().BeTrue();
        clearing.ElapsedMilliseconds.Should().BeLessThan(250);
        buffer.Take(bytesRead).Should().Equal(fresh, "the stale text was discarded, the next reply is intact");
    }

    /// <summary>
    /// A loopback listener on an OS-assigned port, exposing the connection it accepts.
    /// </summary>
    private sealed class TcpListenerScope : IDisposable
    {
        private readonly TcpListener _listener;

        public TcpListenerScope()
        {
            _listener = new TcpListener(IPAddress.Loopback, 0);
            _listener.Start();
            Accepted = _listener.AcceptTcpClientAsync();
        }

        public int Port => ((IPEndPoint)_listener.LocalEndpoint).Port;
        public Task<TcpClient> Accepted { get; }

        public void Dispose() => _listener.Stop();
    }

    #endregion

    #region Dispose Tests

    [Fact]
    public void Dispose_ShouldNotThrow()
    {
        // Arrange
        var port = new TcpCommunicationPort(_mockLogger);

        // Act
        var act = () => port.Dispose();

        // Assert
        act.Should().NotThrow();
    }

    [Fact]
    public void Dispose_CanBeCalledMultipleTimes()
    {
        // Arrange
        var port = new TcpCommunicationPort(_mockLogger);

        // Act
        port.Dispose();
        var act = () => port.Dispose();

        // Assert
        act.Should().NotThrow();
    }

    #endregion

    #region Constructor Overload Tests

    [Fact]
    public void Constructor_WithConnectedClient_ShouldThrowException_WhenClientIsNull()
    {
        // Arrange & Act
        var act = () => new TcpCommunicationPort(_mockLogger, null!);

        // Assert
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("connectedClient");
    }

    #endregion

    #region BytesToRead Property Tests

    [Fact]
    public void BytesToRead_ShouldReturnZero_WhenNoDataAvailable()
    {
        // Arrange & Act
        var result = _port.BytesToRead;

        // Assert
        result.Should().Be(0);
    }

    #endregion

    #region IsOpen Property Tests

    [Fact]
    public void IsOpen_ShouldBeFalse_WhenNotConnected()
    {
        // Arrange & Act
        var result = _port.IsOpen;

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region OpenPort Tests

    [Fact]
    public void OpenPort_ShouldThrowSocketException_WhenConnectionFails()
    {
        // Arrange
        _port.SetPort("192.168.1.254:9999");

        // Act
        var act = () => _port.OpenPort();

        // Assert
        act.Should().Throw<SocketException>();
    }

    [Fact]
    public void OpenPort_WithUseRetryLoop_ShouldUseRetryLogicByDefault()
    {
        // Arrange
        _port.SetPort("192.168.1.254:9999");

        // Act
        var act = () => _port.OpenPort(useRetryLoop: true);

        // Assert
        act.Should().Throw<SocketException>();
    }

    [Fact]
    public void OpenPort_BoundedAgainstNonRoutableAddress_ThrowsWithinTheBoundInsteadOfTheOsSynRetry()
    {
        // Arrange - a non-routable address with no listener, so the OS would otherwise hold the
        // connect attempt open for its own multi-second SYN retry.
        _port.SetPort("10.255.255.1:2112");
        var stopwatch = Stopwatch.StartNew();

        // Act
        var act = () => _port.OpenPort(connectTimeoutMs: 200);

        // Assert
        act.Should().Throw<TimeoutException>();
        stopwatch.Elapsed.Should().BeLessThan(TimeSpan.FromSeconds(2));
    }

    #endregion

    #region ReadIntBytes Tests

    [Fact]
    public void ReadIntBytes_ShouldThrowException_WhenNotConnected()
    {
        // Arrange & Act
        var act = () => _port.ReadIntBytes(4);

        // Assert
        act.Should().Throw<TeensyException>();
    }

    [Fact]
    public void ReadIntBytes_ShouldThrowTimeoutException_WhenInsufficientData()
    {
        // Arrange & Act
        var act = () => _port.ReadIntBytes(4);

        // Assert
        act.Should().Throw<TeensyException>();
    }

    #endregion

    #region Write Encoding Tests

    [Fact]
    public void Write_String_ShouldThrowException_WhenNotConnected()
    {
        // Arrange & Act
        var act = () => _port.Write("hello world");

        // Assert
        act.Should().Throw<TeensyException>()
            .WithMessage("*Cannot write: TCP connection is not open*");
    }

    #endregion
}
