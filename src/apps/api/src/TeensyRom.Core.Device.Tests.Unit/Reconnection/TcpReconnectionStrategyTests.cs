using System.Reactive.Linq;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Core.Device.Tests.Unit.Reconnection;

/// <summary>
/// Unit tests for TcpReconnectionStrategy.
/// Tests verify that TCP reconnection retries with backoff and handles failures correctly.
/// </summary>
public class TcpReconnectionStrategyTests
{
    private readonly ILoggingService _mockLog;
    private readonly IFwVersionChecker _mockVersionChecker;
    private readonly TcpReconnectionStrategy _sut;

    public TcpReconnectionStrategyTests()
    {
        _mockLog = Substitute.For<ILoggingService>();
        _mockVersionChecker = Substitute.For<IFwVersionChecker>();
        _sut = new TcpReconnectionStrategy(_mockLog, _mockVersionChecker);
    }

    #region TryReconnect Tests

    [Fact]
    public async Task TryReconnect_ShouldReturnTrue_WhenConnectionSucceedsOnFirstAttempt()
    {
        // Arrange
        var device = CreateMockTcpDevice("192.168.1.42", 80);
        var ct = CancellationToken.None;

        // Mock version check to succeed
        _mockVersionChecker.GetAllVersionInfo(Arg.Any<ISerialStateContext>())
            .Returns((true, false, true, new Version(1, 0)));

        // Act
        var result = await _sut.TryReconnect(device, ct);

        // Assert
        result.Should().BeTrue();
        _mockVersionChecker.Received(1).GetAllVersionInfo(Arg.Any<ISerialStateContext>());
        _mockLog.Received().InternalSuccess(Arg.Is<string>(s => s.Contains("Successfully reconnected")));
    }

    [Fact]
    public async Task TryReconnect_ShouldRetryThreeTimes_WhenAllAttemptsFail()
    {
        // Arrange
        var device = CreateMockTcpDevice("192.168.1.42", 80);
        var ct = CancellationToken.None;

        // Mock version check to fail
        _mockVersionChecker.GetAllVersionInfo(Arg.Any<ISerialStateContext>())
            .Returns((false, false, false, null));

        // Act
        var result = await _sut.TryReconnect(device, ct);

        // Assert
        result.Should().BeFalse();
        _mockVersionChecker.Received(3).GetAllVersionInfo(Arg.Any<ISerialStateContext>());
    }

    [Fact]
    public async Task TryReconnect_ShouldUseBackoffDelays_BetweenRetries()
    {
        // Arrange
        var device = CreateMockTcpDevice("192.168.1.42", 80);
        var ct = CancellationToken.None;
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        // Mock version check to fail
        _mockVersionChecker.GetAllVersionInfo(Arg.Any<ISerialStateContext>())
            .Returns((false, false, false, null));

        // Act
        var result = await _sut.TryReconnect(device, ct);

        // Assert
        result.Should().BeFalse();
        stopwatch.Stop();

        // Should have taken at least 500ms + 1000ms = 1500ms for backoffs
        stopwatch.ElapsedMilliseconds.Should().BeGreaterOrEqualTo(1400); // Allow some tolerance
    }

    [Fact]
    public async Task TryReconnect_ShouldReturnTrue_WhenSucceedsOnSecondAttempt()
    {
        // Arrange
        var device = CreateMockTcpDevice("192.168.1.42", 80);
        var ct = CancellationToken.None;

        // Mock version check to fail on first attempt, succeed on second
        var callCount = 0;
        _mockVersionChecker.GetAllVersionInfo(Arg.Any<ISerialStateContext>())
            .Returns(x =>
            {
                callCount++;
                return callCount == 1
                    ? (false, false, false, null)  // First attempt fails
                    : (true, false, true, new Version(1, 0)); // Second attempt succeeds
            });

        // Act
        var result = await _sut.TryReconnect(device, ct);

        // Assert
        result.Should().BeTrue();
        _mockVersionChecker.Received(2).GetAllVersionInfo(Arg.Any<ISerialStateContext>());
        _mockLog.Received().Internal(Arg.Is<string>(s => s.Contains("Waiting 500ms")));
    }

    [Fact]
    public async Task TryReconnect_ShouldReturnTrue_WhenSucceedsOnThirdAttempt()
    {
        // Arrange
        var device = CreateMockTcpDevice("192.168.1.42", 80);
        var ct = CancellationToken.None;

        // Mock version check to fail on first two attempts, succeed on third
        var callCount = 0;
        _mockVersionChecker.GetAllVersionInfo(Arg.Any<ISerialStateContext>())
            .Returns(x =>
            {
                callCount++;
                return callCount < 3
                    ? (false, false, false, null)  // First two attempts fail
                    : (true, false, true, new Version(1, 0)); // Third attempt succeeds
            });

        // Act
        var result = await _sut.TryReconnect(device, ct);

        // Assert
        result.Should().BeTrue();
        _mockVersionChecker.Received(3).GetAllVersionInfo(Arg.Any<ISerialStateContext>());
    }

    [Fact]
    public async Task TryReconnect_ShouldNotUpdateCartProperties_WhenReconnectSucceeds()
    {
        // Arrange
        var device = CreateMockTcpDevice("192.168.1.42", 80);
        var ct = CancellationToken.None;

        // Mock version check to succeed
        _mockVersionChecker.GetAllVersionInfo(Arg.Any<ISerialStateContext>())
            .Returns((true, false, true, new Version(1, 0)));

        var originalIpAddress = device.Cart.IpAddress;
        var originalTcpPort = device.Cart.TcpPort;

        // Act
        var result = await _sut.TryReconnect(device, ct);

        // Assert
        result.Should().BeTrue();
        device.Cart.IpAddress.Should().Be(originalIpAddress);
        device.Cart.TcpPort.Should().Be(originalTcpPort);
    }

    [Fact]
    public async Task TryReconnect_ShouldUseCorrectEndpointFormat()
    {
        // Arrange
        var device = CreateMockTcpDevice("192.168.1.42", 8080);
        var ct = CancellationToken.None;

        // Mock version check to succeed
        _mockVersionChecker.GetAllVersionInfo(Arg.Any<ISerialStateContext>())
            .Returns((true, false, true, new Version(1, 0)));

        // Act
        var result = await _sut.TryReconnect(device, ct);

        // Assert
        result.Should().BeTrue();
        device.SerialState.Received().SetPort("192.168.1.42:8080");
    }

    [Fact]
    public async Task TryReconnect_ShouldClosePort_WhenAllAttemptsFail()
    {
        // Arrange
        var device = CreateMockTcpDevice("192.168.1.42", 80);
        var ct = CancellationToken.None;

        // Mock version check to fail
        _mockVersionChecker.GetAllVersionInfo(Arg.Any<ISerialStateContext>())
            .Returns((false, false, false, null));

        // Act
        var result = await _sut.TryReconnect(device, ct);

        // Assert
        result.Should().BeFalse();
        device.SerialState.Received().ClosePort();
        _mockLog.Received().InternalError(Arg.Is<string>(s => s.Contains("Could not reconnect")));
    }

    [Fact]
    public async Task TryReconnect_ShouldLogRetryAttempts()
    {
        // Arrange
        var device = CreateMockTcpDevice("192.168.1.42", 80);
        var ct = CancellationToken.None;

        // Mock version check to fail
        _mockVersionChecker.GetAllVersionInfo(Arg.Any<ISerialStateContext>())
            .Returns((false, false, false, null));

        // Act
        await _sut.TryReconnect(device, ct);

        // Assert
        _mockLog.Received().Internal(Arg.Is<string>(s => s.Contains("Retry attempt 1/3")));
        _mockLog.Received().Internal(Arg.Is<string>(s => s.Contains("Retry attempt 2/3")));
        _mockLog.Received().Internal(Arg.Is<string>(s => s.Contains("Retry attempt 3/3")));
    }

    [Fact]
    public async Task TryReconnect_ShouldThrow_WhenCancelled()
    {
        // Arrange
        var device = CreateMockTcpDevice("192.168.1.42", 80);
        var cts = new CancellationTokenSource();
        cts.Cancel();

        // Act & Assert
        await Assert.ThrowsAsync<OperationCanceledException>(
            async () => await _sut.TryReconnect(device, cts.Token));
    }

    [Fact]
    public async Task TryReconnect_ShouldNotDoNetworkRescan()
    {
        // Arrange
        var device = CreateMockTcpDevice("192.168.1.42", 80);
        var ct = CancellationToken.None;

        // Mock version check to fail
        _mockVersionChecker.GetAllVersionInfo(Arg.Any<ISerialStateContext>())
            .Returns((false, false, false, null));

        // Act
        await _sut.TryReconnect(device, ct);

        // Assert
        // Should only call SetPort with the original endpoint 3 times (once per retry)
        // No other endpoints should be tried
        device.SerialState.Received(3).SetPort("192.168.1.42:80");
    }

    #endregion

    #region Helper Methods

    private TeensyRomDevice CreateMockTcpDevice(string ipAddress, int tcpPort)
    {
        var mockSerialState = Substitute.For<ISerialStateContext>();
        var mockSerialPort = Substitute.For<IObservableSerialPort>();
        var mockState = new SerialConnectedState(mockSerialPort);

        // Setup observable for CurrentState
        var stateSubject = new System.Reactive.Subjects.BehaviorSubject<SerialState>(mockState);
        mockSerialState.CurrentState.Returns(stateSubject.AsObservable());
        mockSerialState.IsOpen.Returns(false);
        mockSerialState.When(x => x.SetPort(Arg.Any<string>())).Do(callInfo => { });
        mockSerialState.When(x => x.OpenPort()).Do(callInfo => { });
        mockSerialState.When(x => x.Lock()).Do(callInfo => { });
        mockSerialState.When(x => x.ClosePort()).Do(callInfo => { });
        mockSerialState.When(x => x.TransitionTo(Arg.Any<Type>())).Do(callInfo => { });

        var cart = new Cart
        {
            DeviceId = "test-device",
            Name = "Test Device",
            ComPort = string.Empty,
            ConnectionType = ConnectionType.Tcp,
            IpAddress = ipAddress,
            TcpPort = tcpPort,
            SdStorage = new CartStorage { DeviceId = "test-device", Type = TeensyStorageType.SD },
            UsbStorage = new CartStorage { DeviceId = "test-device", Type = TeensyStorageType.USB }
        };

        return new TeensyRomDevice(
            cart,
            mockSerialState,
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>()
        );
    }

    #endregion
}
