using System.Reflection;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial;
using TeensyRom.Core.Serial.Commands;
using TeensyRom.Core.Serial.Commands.Behaviors;
using TeensyRom.Core.Serial.Commands.LaunchFile;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial.Tests.Unit.Commands.Behaviors;

public class CommunicationPortBehaviorTests
{
    private sealed class FakeCommand : ITeensyCommand<TeensyCommandResult>
    {
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
    }

    /// <summary>
    /// Records the gate's own port traffic (open/clear/reset) so tests can assert on it directly - no
    /// firmware check or busy ping to answer, since the gate no longer sends either.
    /// <see cref="WaitForSerialData"/> times out immediately by default, so a raw <c>ResetDevice</c> call
    /// (its idle-read loop) returns fast with an empty reply unless a test scripts otherwise.
    /// </summary>
    private sealed class StubCommunicationPort : ICommunicationPort
    {
        public bool IsOpen { get; set; } = true;
        public int BytesToRead => 0;
        public List<uint> SentTokens { get; } = [];
        public int ClosePortCallCount { get; private set; }

        /// <summary>Runs inside <see cref="OpenPort"/> before it marks the port open; throw here to simulate a failed open.</summary>
        public Action? OpenPortAction { get; set; }

        /// <summary>Runs instead of the default immediate timeout; throw a non-<see cref="TimeoutException"/> to simulate a drop mid-read.</summary>
        public Action? WaitForSerialDataAction { get; set; }

        public void ClearBuffers() { }
        public void SendIntBytes(uint intToSend, short numBytes) => SentTokens.Add(intToSend);
        public uint ReadIntBytes(short byteLength) => 0;
        public int Read(byte[] buffer, int offset, int count) => 0;
        public int ReadByte() => -1;
        public void Write(string text) { }
        public void Write(byte[] buffer, int offset, int count) { }
        public void Write(char[] buffer, int offset, int count) { }
        public System.Reactive.Unit SetPort(string port) => System.Reactive.Unit.Default;

        public string? OpenPort(bool useRetryLoop = true)
        {
            OpenPortAction?.Invoke();
            IsOpen = true;
            return "TEST";
        }

        public System.Reactive.Unit ClosePort()
        {
            ClosePortCallCount++;
            IsOpen = false;
            return System.Reactive.Unit.Default;
        }

        public string ReadSerialAsString(int msToWait = 0) => string.Empty;
        public string ReadAndLogSerialAsString(int msToWait = 0) => string.Empty;
        public byte[] ReadSerialBytes() => [];
        public byte[] ReadSerialBytes(int msToWait = 0) => [];

        public void WaitForSerialData(int numBytes, int timeoutMs)
        {
            if (WaitForSerialDataAction is not null)
            {
                WaitForSerialDataAction();
                return;
            }
            throw new TimeoutException();
        }

        public void SendSignedChar(sbyte charToSend) { }
        public void SendSignedShort(short value) { }
        public string GetEndpoint() => "TEST";
        public ConnectionType GetConnectionType() => ConnectionType.Tcp;
        public void Dispose() { }
    }

    /// <summary>A device with a default, confirmed <see cref="DeviceMode.FullIdle"/> record on <paramref name="port"/>.</summary>
    private static TeensyRomDevice BuildDevice(StubCommunicationPort port, string deviceId)
    {
        var cart = new Cart { DeviceId = deviceId };
        return new TeensyRomDevice(cart, port, Substitute.For<IStorageService>(), Substitute.For<IStorageService>());
    }

    /// <summary>
    /// Reproduces the defect directly: a command that legitimately outlives the stale-lock cutoff must
    /// not have its semaphore disposed by a second command's concurrent cleanup pass. Shortens the
    /// private static cutoff via reflection rather than waiting five real minutes - the field itself is
    /// production-only state, not a test hook added to production code.
    /// </summary>
    [Fact]
    public async Task Handle_LongRunningCommandHoldsLock_ConcurrentCleanupPassDoesNotDisposeIt()
    {
        var staleLockField = typeof(CommunicationPortBehavior<FakeCommand, TeensyCommandResult>)
            .GetField("_staleLockMinutes", BindingFlags.NonPublic | BindingFlags.Static)!;
        var original = staleLockField.GetValue(null);
        staleLockField.SetValue(null, TimeSpan.Zero); // every existing lock entry is immediately "stale" by its last-used timestamp

        try
        {
            var log = Substitute.For<ILoggingService>();
            var devices = Substitute.For<IDeviceConnectionManager>();
            var recovery = Substitute.For<IDeviceRecovery>();
            var behaviorA = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(log, devices, recovery);
            var behaviorB = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(log, devices, recovery);
            var deviceId = Guid.NewGuid().ToString("N");
            var commandA = new FakeCommand { DeviceId = deviceId, CommunicationPort = new StubCommunicationPort() };
            var commandB = new FakeCommand { DeviceId = deviceId, CommunicationPort = new StubCommunicationPort() };
            var aAcquired = new TaskCompletionSource();

            var taskA = behaviorA.Handle(commandA, async () =>
            {
                aAcquired.SetResult();
                await Task.Delay(200);
                return new TeensyCommandResult();
            }, CancellationToken.None);

            await aAcquired.Task;

            // B's Handle call runs CleanupStaleLocks - with the zeroed cutoff, every entry is stale by
            // timestamp alone - while A still holds the semaphore for the same device.
            var resultB = await behaviorB.Handle(
                commandB, () => Task.FromResult(new TeensyCommandResult()), CancellationToken.None);
            var resultA = await taskA;

            resultA.IsSuccess.Should().BeTrue();
            resultB.IsSuccess.Should().BeTrue();
        }
        finally
        {
            staleLockField.SetValue(null, original);
        }
    }

    [Fact]
    public async Task Handle_DefaultRecord_SendsExactlyOneExchange_NoFwCheckOrPingBytes()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, Substitute.For<IDeviceRecovery>());
        var command = new FakeCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new TeensyCommandResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeTrue();
        invocations.Should().Be(1);
        port.SentTokens.Should().NotContain(TeensyToken.FwCheckToken.Value);
        port.SentTokens.Should().NotContain(TeensyToken.Ping.Value);
    }

    [Fact]
    public async Task Handle_BusyOnceThenSucceeds_ResetsOnceInvokesHandlerTwiceRecordEndsFullIdle()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, Substitute.For<IDeviceRecovery>());
        var command = new FakeCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            if (invocations == 1)
            {
                throw new TeensyBusyException("busy");
            }
            return Task.FromResult(new TeensyCommandResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeTrue();
        invocations.Should().Be(2);
        port.SentTokens.Count(t => t == TeensyToken.Reset.Value).Should().Be(1);
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
    }

    [Fact]
    public async Task Handle_BusyTwice_ResetsOnceExceptionPropagatesRecordEndsFullBusy()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, Substitute.For<IDeviceRecovery>());
        var command = new FakeCommand { DeviceId = deviceId, CommunicationPort = port };

        Func<Task> act = () => behavior.Handle(command, () => throw new TeensyBusyException("busy"), CancellationToken.None);

        await act.Should().ThrowAsync<TeensyBusyException>();
        port.SentTokens.Count(t => t == TeensyToken.Reset.Value).Should().Be(1);
        device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
    }

    [Fact]
    public async Task Handle_HandlerThrowsWithPortReportingClosed_RecoversWithDropAndPropagates_GateNeverClosesPort()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var recovery = Substitute.For<IDeviceRecovery>();
        recovery.RecoverAsync(device, RecoveryReason.Drop, Arg.Any<CancellationToken>())
            .Returns(new RecoveryOutcome(DeviceMode.Unreachable, TimeSpan.Zero, TimeSpan.Zero, "dropped"));
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, recovery);
        var command = new FakeCommand { DeviceId = deviceId, CommunicationPort = port };

        Func<Task> act = () => behavior.Handle(command, () =>
        {
            port.IsOpen = false;
            throw new TeensyException("boom");
        }, CancellationToken.None);

        await act.Should().ThrowAsync<TeensyException>();
        await recovery.Received(1).RecoverAsync(device, RecoveryReason.Drop, Arg.Any<CancellationToken>());
        port.ClosePortCallCount.Should().Be(0);
    }

    /// <summary>
    /// The believed-busy device is the one a handler-swapping launch left running a game: the firmware
    /// answers Busy! to everything until it is reset, so the gate has to reset before the command runs,
    /// not after the handler has already swallowed the Busy! reply.
    /// </summary>
    [Fact]
    public async Task Handle_FullBusyRecordNonLaunchCommand_ResetsBeforeHandlerRuns_RecordEndsFullIdle()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        device.MarkBusy();
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var recovery = Substitute.For<IDeviceRecovery>();
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, recovery);
        var command = new FakeCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;
        var modeWhenHandlerRan = default(DeviceMode?);
        var resetsWhenHandlerRan = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            modeWhenHandlerRan = device.Connection.Mode;
            resetsWhenHandlerRan = port.SentTokens.Count(t => t == TeensyToken.Reset.Value);
            return Task.FromResult(new TeensyCommandResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeTrue();
        invocations.Should().Be(1);
        resetsWhenHandlerRan.Should().Be(1);
        modeWhenHandlerRan.Should().Be(DeviceMode.FullIdle);
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        await recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// The busy exemption is launch-specific and deliberate, not an oversight: the firmware dispatches
    /// <c>LaunchFileToken</c> above the busy gate (SerUSBIO.ino:549, "only these commands are available
    /// when busy"), so a cart-running device accepts a launch by design and resetting first would cost a
    /// reboot for nothing.
    /// </summary>
    [Fact]
    public async Task Handle_FullBusyRecordLaunchFileCommand_SkipsTheResetAndLeavesTheRecordBusy()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        device.MarkBusy();
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var behavior = new CommunicationPortBehavior<LaunchFileCommand, LaunchFileResult>(
            Substitute.For<ILoggingService>(), devices, Substitute.For<IDeviceRecovery>());
        var command = new LaunchFileCommand
        {
            StorageType = TeensyStorageType.SD,
            LaunchItem = new LaunchableItem(),
            DeviceId = deviceId,
            CommunicationPort = port
        };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new LaunchFileResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeTrue();
        invocations.Should().Be(1);
        port.SentTokens.Should().NotContain(TeensyToken.Reset.Value);
        device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
    }

    [Fact]
    public async Task Handle_MinimalNonLaunchCommand_RecoveryAnswersMinimal_FailsWithoutRunningHandler()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        device.Confirm(ConnectionType.Tcp, "TEST", DeviceMode.Minimal);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var recovery = Substitute.For<IDeviceRecovery>();
        recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, Arg.Any<CancellationToken>())
            .Returns(new RecoveryOutcome(DeviceMode.Minimal, TimeSpan.Zero, TimeSpan.Zero, "still minimal"));
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, recovery);
        var command = new FakeCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new TeensyCommandResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeFalse();
        response.Error.Should().Be("Command Failed. Cart was in Minimal and could not be brought back to full firmware.");
        invocations.Should().Be(0);
        port.SentTokens.Count(t => t == TeensyToken.Reset.Value).Should().Be(1);
        await recovery.Received(1).RecoverAsync(device, RecoveryReason.LeaveMinimal, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_MinimalRecordLaunchFileCommand_RecoveryAnswersFull_ResetsAndRecoversBeforeHandlerRuns()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        device.Confirm(ConnectionType.Tcp, "TEST", DeviceMode.Minimal);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var recovery = Substitute.For<IDeviceRecovery>();
        recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, Arg.Any<CancellationToken>())
            .Returns(new RecoveryOutcome(DeviceMode.FullIdle, TimeSpan.Zero, TimeSpan.Zero, null));
        var behavior = new CommunicationPortBehavior<LaunchFileCommand, LaunchFileResult>(
            Substitute.For<ILoggingService>(), devices, recovery);
        var command = new LaunchFileCommand
        {
            StorageType = TeensyStorageType.SD,
            LaunchItem = new LaunchableItem(),
            DeviceId = deviceId,
            CommunicationPort = port
        };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new LaunchFileResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeTrue();
        invocations.Should().Be(1);
        port.SentTokens.Count(t => t == TeensyToken.Reset.Value).Should().Be(1);
        await recovery.Received(1).RecoverAsync(device, RecoveryReason.LeaveMinimal, Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// The trap this closes: the gate's generic failure result is constructed via <c>new()</c> with only
    /// <c>IsSuccess</c> set, so <c>LaunchFileResult.LaunchResult</c> would silently read as its enum
    /// default if that default were <see cref="LaunchFileResultType.Success"/>. Asserted directly on the
    /// typed result rather than relied upon via the endpoint's <c>IsSuccess</c> branch.
    /// </summary>
    [Fact]
    public async Task Handle_MinimalRecordLaunchFileCommand_RecoveryAnswersMinimal_FailsWithoutRunningHandler()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        device.Confirm(ConnectionType.Tcp, "TEST", DeviceMode.Minimal);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var recovery = Substitute.For<IDeviceRecovery>();
        recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, Arg.Any<CancellationToken>())
            .Returns(new RecoveryOutcome(DeviceMode.Minimal, TimeSpan.Zero, TimeSpan.Zero, "still minimal"));
        var behavior = new CommunicationPortBehavior<LaunchFileCommand, LaunchFileResult>(
            Substitute.For<ILoggingService>(), devices, recovery);
        var command = new LaunchFileCommand
        {
            StorageType = TeensyStorageType.SD,
            LaunchItem = new LaunchableItem(),
            DeviceId = deviceId,
            CommunicationPort = port
        };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new LaunchFileResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeFalse();
        response.LaunchResult.Should().NotBe(LaunchFileResultType.Success);
        invocations.Should().Be(0);
        port.SentTokens.Count(t => t == TeensyToken.Reset.Value).Should().Be(1);
        await recovery.Received(1).RecoverAsync(device, RecoveryReason.LeaveMinimal, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_PortReportingClosedAndOpenPortThrows_RecoversWithDropAndPropagates()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort
        {
            IsOpen = false,
            OpenPortAction = () => throw new InvalidOperationException("The port is closed.")
        };
        var device = BuildDevice(port, deviceId);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var recovery = Substitute.For<IDeviceRecovery>();
        recovery.RecoverAsync(device, RecoveryReason.Drop, Arg.Any<CancellationToken>())
            .Returns(new RecoveryOutcome(DeviceMode.Unreachable, TimeSpan.Zero, TimeSpan.Zero, "dropped"));
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, recovery);
        var command = new FakeCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        Func<Task> act = () => behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new TeensyCommandResult());
        }, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>();
        await recovery.Received(1).RecoverAsync(device, RecoveryReason.Drop, Arg.Any<CancellationToken>());
        invocations.Should().Be(0);
    }

    [Fact]
    public async Task Handle_PortReportingClosedAndOpenPortSucceeds_NoRecoveryRuns()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort { IsOpen = false };
        var device = BuildDevice(port, deviceId);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var recovery = Substitute.For<IDeviceRecovery>();
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, recovery);
        var command = new FakeCommand { DeviceId = deviceId, CommunicationPort = port };

        var response = await behavior.Handle(command, () => Task.FromResult(new TeensyCommandResult()), CancellationToken.None);

        response.IsSuccess.Should().BeTrue();
        await recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public void ResetDevice_ReplyReadThrowsDropClassException_ReturnsNormally()
    {
        var port = new StubCommunicationPort
        {
            IsOpen = false,
            WaitForSerialDataAction = () => throw new InvalidOperationException("The port is closed.")
        };
        var log = Substitute.For<ILoggingService>();

        var act = () => port.ResetDevice(log);

        act.Should().NotThrow();
    }
}
