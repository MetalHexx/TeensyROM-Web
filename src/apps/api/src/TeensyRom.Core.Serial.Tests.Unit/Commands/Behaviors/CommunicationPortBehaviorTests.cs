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
using TeensyRom.Core.Serial.Tests.Unit.Routines;

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
    private static TeensyRomDevice BuildDevice(ICommunicationPort port, string deviceId)
    {
        var cart = new Cart { DeviceId = deviceId };
        return new TeensyRomDevice(cart, port, Substitute.For<IStorageService>(), Substitute.For<IStorageService>());
    }

    /// <summary>
    /// A <see cref="ScriptedCommunicationPort"/> whose <c>ResetDevice</c> call succeeds fast: the menu's
    /// boot token lands after a virtual quiet gap, then one version poll reports boot complete. Three
    /// segments queue up because three separate <c>ClearBuffers</c> calls run before the version reply is
    /// readable: the gate's own clear at the top of <c>Handle</c>, then <c>WaitForMenuBootToken</c>'s clear
    /// once it finds the token, then <c>ReadVersionReply</c>'s clear before it sends the version request -
    /// the first two have nothing to absorb, so they are empty placeholders.
    /// </summary>
    private static ScriptedCommunicationPort PortWithSuccessfulReset()
    {
        var port = new ScriptedCommunicationPort();
        port.EnqueueTokenAfterQuiet(650, TeensyToken.GoodSIDToken);
        port.NewSegment();
        port.NewSegment();
        port.NewSegment().EnqueueToken(TeensyToken.Ack).EnqueueText("Boot: complete\n");
        return port;
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
            var behaviorA = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(log, devices, recovery, new ConnectionOptions());
            var behaviorB = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(log, devices, recovery, new ConnectionOptions());
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
            Substitute.For<ILoggingService>(), devices, Substitute.For<IDeviceRecovery>(), new ConnectionOptions());
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
        var port = PortWithSuccessfulReset();
        var device = BuildDevice(port, deviceId);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, Substitute.For<IDeviceRecovery>(), new ConnectionOptions());
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
        port.Written.Should().Equal(0x64, 0xEE, 0x64, 0x76);
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
    }

    [Fact]
    public async Task Handle_BusyTwice_ResetsOnceExceptionPropagatesRecordEndsFullBusy()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = PortWithSuccessfulReset();
        var device = BuildDevice(port, deviceId);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, Substitute.For<IDeviceRecovery>(), new ConnectionOptions());
        var command = new FakeCommand { DeviceId = deviceId, CommunicationPort = port };

        Func<Task> act = () => behavior.Handle(command, () => throw new TeensyBusyException("busy"), CancellationToken.None);

        await act.Should().ThrowAsync<TeensyBusyException>();
        port.Written.Should().Equal(0x64, 0xEE, 0x64, 0x76);
        device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
    }

    /// <summary>
    /// The reset the reactive-busy backstop fires can itself miss (the menu never re-announced itself, or
    /// never reported boot complete) - the command must fail with a legible reason instead of retrying
    /// into a device that may still be mid-boot.
    /// </summary>
    [Fact]
    public async Task Handle_BusyOnce_ResetMisses_FailsWithoutRetryingRecordEndsFullBusy()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, Substitute.For<IDeviceRecovery>(), new ConnectionOptions());
        var command = new FakeCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            throw new TeensyBusyException("busy");
        }, CancellationToken.None);

        response.IsSuccess.Should().BeFalse();
        response.Error.Should().Be("Command Failed. The menu did not come back up after the reset.");
        invocations.Should().Be(1);
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
            Substitute.For<ILoggingService>(), devices, recovery, new ConnectionOptions());
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
        var port = PortWithSuccessfulReset();
        var device = BuildDevice(port, deviceId);
        device.MarkBusy();
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var recovery = Substitute.For<IDeviceRecovery>();
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, recovery, new ConnectionOptions());
        var command = new FakeCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;
        var modeWhenHandlerRan = default(DeviceMode?);
        byte[]? writtenWhenHandlerRan = null;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            modeWhenHandlerRan = device.Connection.Mode;
            writtenWhenHandlerRan = port.Written.ToArray();
            return Task.FromResult(new TeensyCommandResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeTrue();
        invocations.Should().Be(1);
        writtenWhenHandlerRan.Should().Equal(0x64, 0xEE, 0x64, 0x76);
        modeWhenHandlerRan.Should().Be(DeviceMode.FullIdle);
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        await recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// The reset the pre-check fires before a non-launch command can itself miss - the command must fail
    /// with a legible reason instead of being sent into a device that may still be mid-boot, and the
    /// handler must never run.
    /// </summary>
    [Fact]
    public async Task Handle_FullBusyRecordNonLaunchCommand_ResetMisses_FailsWithoutRunningHandler()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        device.MarkBusy();
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, Substitute.For<IDeviceRecovery>(), new ConnectionOptions());
        var command = new FakeCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new TeensyCommandResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeFalse();
        response.Error.Should().Be("Command Failed. The menu did not come back up after the reset.");
        invocations.Should().Be(0);
        device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
    }

    /// <summary>
    /// Bench, no internet: the menu came back after every reset but took ~9.5 s to finish booting. Left
    /// busy, the record made every following command reset the C64 again - which was already sitting in
    /// the menu - and fail the same way. The SID token proves the reset took, so the record is idle with
    /// its boot pending.
    /// </summary>
    [Fact]
    public async Task Handle_FullBusyRecordNonLaunchCommand_MenuBackButStillBooting_FailsAndLeavesTheRecordIdleWithBootPending()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new ScriptedCommunicationPort();
        port.EnqueueTokenAfterQuiet(650, TeensyToken.GoodSIDToken);
        port.NewSegment(); // the gate's own buffer clear
        port.NewSegment(); // the token wait's buffer clear
        port.NewSegment().EnqueueToken(TeensyToken.Ack).EnqueueText("Boot: in progress\n");
        var device = BuildDevice(port, deviceId);
        device.MarkBusy();
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, Substitute.For<IDeviceRecovery>(), new ConnectionOptions { MenuBootTimeoutMs = 1000 });
        var command = new FakeCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new TeensyCommandResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeFalse();
        response.Error.Should().Contain("has not finished booting");
        invocations.Should().Be(0);
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        device.Connection.MenuBootPending.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_MenuBootPendingRecord_ChecksTheBootInsteadOfResetting_ThenRunsTheCommand()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new ScriptedCommunicationPort();
        port.NewSegment(); // the gate's own buffer clear
        port.NewSegment().EnqueueToken(TeensyToken.Ack).EnqueueText("Boot: complete\n");
        var device = BuildDevice(port, deviceId);
        device.MarkMenuBootPending();
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var behavior = new CommunicationPortBehavior<FakeCommand, TeensyCommandResult>(
            Substitute.For<ILoggingService>(), devices, Substitute.For<IDeviceRecovery>(), new ConnectionOptions());
        var command = new FakeCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new TeensyCommandResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeTrue();
        invocations.Should().Be(1);
        port.Written.Should().Equal(0x64, 0x76); // one version request, no reset token
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        device.Connection.MenuBootPending.Should().BeFalse();
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
            Substitute.For<ILoggingService>(), devices, Substitute.For<IDeviceRecovery>(), new ConnectionOptions());
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
            Substitute.For<ILoggingService>(), devices, recovery, new ConnectionOptions());
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
            Substitute.For<ILoggingService>(), devices, recovery, new ConnectionOptions());
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
            Substitute.For<ILoggingService>(), devices, recovery, new ConnectionOptions());
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

    /// <summary>
    /// Bench (UI Stop after a game launch): one reset command reset the C64 twice - the gate's reset of the
    /// busy device, then the handler's own - 29.5 s for what one ~15 s reset already did. The gate's reset
    /// brings the C64 back to the menu, which is all a reset command asks for.
    /// </summary>
    [Fact]
    public async Task Handle_FullBusyRecordResetCommand_GateResetIsTheReset_HandlerDoesNotRun_RecordEndsFullIdle()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = PortWithSuccessfulReset();
        var device = BuildDevice(port, deviceId);
        device.MarkBusy();
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var log = Substitute.For<ILoggingService>();
        var behavior = new CommunicationPortBehavior<ResetCommand, ResetResult>(
            log, devices, Substitute.For<IDeviceRecovery>(), new ConnectionOptions());
        var command = new ResetCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new ResetResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeTrue();
        invocations.Should().Be(0);
        port.Written.Should().Equal(0x64, 0xEE, 0x64, 0x76); // one reset token, then the boot-complete version poll
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        device.Connection.MenuBootPending.Should().BeFalse();
        log.Received(1).Internal(Arg.Is<string>(m => m.Contains("not resetting again")), Arg.Any<string?>());
    }

    [Fact]
    public async Task Handle_FullBusyRecordResetCommand_ResetMisses_FailsWithoutRunningHandler()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        device.MarkBusy();
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var behavior = new CommunicationPortBehavior<ResetCommand, ResetResult>(
            Substitute.For<ILoggingService>(), devices, Substitute.For<IDeviceRecovery>(), new ConnectionOptions());
        var command = new ResetCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new ResetResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeFalse();
        response.Error.Should().Be("Command Failed. The menu did not come back up after the reset.");
        invocations.Should().Be(0);
        port.SentTokens.Count(t => t == TeensyToken.Reset.Value).Should().Be(1);
        device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
    }

    /// <summary>
    /// The gate's reset took (the menu's SID token arrived) but the menu is still booting: the command fails
    /// the way any command does there, rather than succeeding over a menu that has not finished booting or
    /// resetting it again, and the next command checks the boot.
    /// </summary>
    [Fact]
    public async Task Handle_FullBusyRecordResetCommand_MenuBackButStillBooting_FailsWithoutRunningHandler_BootPending()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new ScriptedCommunicationPort();
        port.EnqueueTokenAfterQuiet(650, TeensyToken.GoodSIDToken);
        port.NewSegment(); // the gate's own buffer clear
        port.NewSegment(); // the token wait's buffer clear
        port.NewSegment().EnqueueToken(TeensyToken.Ack).EnqueueText("Boot: in progress\n");
        var device = BuildDevice(port, deviceId);
        device.MarkBusy();
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var behavior = new CommunicationPortBehavior<ResetCommand, ResetResult>(
            Substitute.For<ILoggingService>(), devices, Substitute.For<IDeviceRecovery>(), new ConnectionOptions { MenuBootTimeoutMs = 1000 });
        var command = new ResetCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new ResetResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeFalse();
        response.Error.Should().Be("Command Failed. The C64 menu came back after the reset but has not finished booting within 1 s.");
        invocations.Should().Be(0);
        port.Written.Zip(port.Written.Skip(1)).Count(pair => pair is (0x64, 0xEE)).Should().Be(1); // one reset token
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        device.Connection.MenuBootPending.Should().BeTrue();
    }

    /// <summary>
    /// Leaving minimal brought the device back to full but the recovery's own boot wait ran out: the gate
    /// fails the command on the pending boot before the reset exemption is reached.
    /// </summary>
    [Fact]
    public async Task Handle_MinimalRecordResetCommand_RecoveryLeavesBootPending_FailsWithoutRunningHandler()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        device.Confirm(ConnectionType.Tcp, "TEST", DeviceMode.Minimal);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var recovery = Substitute.For<IDeviceRecovery>();
        recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                device.Confirm(ConnectionType.Tcp, "TEST", DeviceMode.FullIdle);
                device.MarkMenuBootPending();
                return new RecoveryOutcome(DeviceMode.FullIdle, TimeSpan.Zero, TimeSpan.Zero, "the C64 menu did not report its boot complete after the reset");
            });
        var behavior = new CommunicationPortBehavior<ResetCommand, ResetResult>(
            Substitute.For<ILoggingService>(), devices, recovery, new ConnectionOptions { MenuBootTimeoutMs = 1000 });
        var command = new ResetCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new ResetResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeFalse();
        response.Error.Should().Be("Command Failed. The C64 menu came back after the reset but has not finished booting within 1 s.");
        invocations.Should().Be(0);
        port.SentTokens.Count(t => t == TeensyToken.Reset.Value).Should().Be(1);
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        device.Connection.MenuBootPending.Should().BeTrue();
    }

    /// <summary>
    /// Leaving minimal reboots the Teensy into full, which resets the C64 into the menu: the reset a reset
    /// command asks for is already done. The recovery substitute confirms the record the way
    /// <see cref="DeviceRecovery"/> does on a full, not-busy reply.
    /// </summary>
    [Fact]
    public async Task Handle_MinimalRecordResetCommand_RecoveryAnswersFullIdle_SucceedsWithoutRunningHandler()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        device.Confirm(ConnectionType.Tcp, "TEST", DeviceMode.Minimal);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var recovery = Substitute.For<IDeviceRecovery>();
        recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                device.Confirm(ConnectionType.Tcp, "TEST", DeviceMode.FullIdle);
                return new RecoveryOutcome(DeviceMode.FullIdle, TimeSpan.Zero, TimeSpan.Zero, null);
            });
        var log = Substitute.For<ILoggingService>();
        var behavior = new CommunicationPortBehavior<ResetCommand, ResetResult>(
            log, devices, recovery, new ConnectionOptions());
        var command = new ResetCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new ResetResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeTrue();
        invocations.Should().Be(0);
        port.SentTokens.Count(t => t == TeensyToken.Reset.Value).Should().Be(1);
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        await recovery.Received(1).RecoverAsync(device, RecoveryReason.LeaveMinimal, Arg.Any<CancellationToken>());
        log.Received(1).Internal(Arg.Is<string>(m => m.Contains("not resetting again")), Arg.Any<string?>());
    }

    /// <summary>
    /// A recovery that comes back busy means the firmware answered Busy! to its storage probe after the
    /// reset - something other than the menu is running - so the gate's reset does not count as the one
    /// the command asks for: the handler still resets, and its success leaves the record idle.
    /// </summary>
    [Fact]
    public async Task Handle_MinimalRecordResetCommand_RecoveryAnswersFullBusy_HandlerStillResets_RecordEndsFullIdle()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        device.Confirm(ConnectionType.Tcp, "TEST", DeviceMode.Minimal);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var recovery = Substitute.For<IDeviceRecovery>();
        recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                device.Confirm(ConnectionType.Tcp, "TEST", DeviceMode.FullIdle);
                device.MarkBusy();
                return new RecoveryOutcome(DeviceMode.FullBusy, TimeSpan.Zero, TimeSpan.Zero, null);
            });
        var behavior = new CommunicationPortBehavior<ResetCommand, ResetResult>(
            Substitute.For<ILoggingService>(), devices, recovery, new ConnectionOptions());
        var command = new ResetCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new ResetResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeTrue();
        invocations.Should().Be(1);
        port.SentTokens.Count(t => t == TeensyToken.Reset.Value).Should().Be(1); // the gate's; the handler here is a stub
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
    }

    /// <summary>An idle device is not touched by the gate: the handler performs the one reset, as before.</summary>
    [Fact]
    public async Task Handle_FullIdleRecordResetCommand_GateSendsNoReset_HandlerRuns()
    {
        var deviceId = Guid.NewGuid().ToString("N");
        var port = new StubCommunicationPort();
        var device = BuildDevice(port, deviceId);
        var devices = Substitute.For<IDeviceConnectionManager>();
        devices.GetAvailableDevice(deviceId).Returns(device);
        var recovery = Substitute.For<IDeviceRecovery>();
        var behavior = new CommunicationPortBehavior<ResetCommand, ResetResult>(
            Substitute.For<ILoggingService>(), devices, recovery, new ConnectionOptions());
        var command = new ResetCommand { DeviceId = deviceId, CommunicationPort = port };
        var invocations = 0;

        var response = await behavior.Handle(command, () =>
        {
            invocations++;
            return Task.FromResult(new ResetResult());
        }, CancellationToken.None);

        response.IsSuccess.Should().BeTrue();
        invocations.Should().Be(1);
        port.SentTokens.Should().NotContain(TeensyToken.Reset.Value);
        device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        await recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
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
            Substitute.For<ILoggingService>(), devices, recovery, new ConnectionOptions());
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
            Substitute.For<ILoggingService>(), devices, recovery, new ConnectionOptions());
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
