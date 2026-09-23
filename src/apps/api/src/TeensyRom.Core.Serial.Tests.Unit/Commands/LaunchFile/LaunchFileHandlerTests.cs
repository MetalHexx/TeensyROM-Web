using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands.LaunchFile;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Tests.Unit.Routines;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Serial.Tests.Unit.Commands.LaunchFile
{
    public class LaunchFileHandlerTests
    {
        private const string ChipId = "19307720";
        private const string DeviceId = "device-1";

        private readonly ILoggingService _log = Substitute.For<ILoggingService>();
        private readonly IDeviceRecovery _recovery = Substitute.For<IDeviceRecovery>();
        private readonly IDeviceConnectionManager _devices = Substitute.For<IDeviceConnectionManager>();
        private readonly IDeviceInterrogator _interrogator = Substitute.For<IDeviceInterrogator>();

        // Two iterations of the watch loop's 25 ms tick: enough for "empty read, then data" scripting
        // without spending real test time - the fake port never actually sleeps.
        private static ConnectionOptions FastOptions() => new() { LaunchSettleMs = 50 };

        private static LaunchFileCommand BuildCommand(ScriptedCommunicationPort port, string? deviceId = null, string path = "/games/game.prg") => new()
        {
            StorageType = TeensyStorageType.SD,
            LaunchItem = new LaunchableItem { Path = new FilePath(path), Size = 900_000 },
            CommunicationPort = port,
            DeviceId = deviceId
        };

        private TeensyRomDevice BuildDevice(ScriptedCommunicationPort port, DeviceMode mode)
        {
            var cart = new Cart { DeviceId = ChipId };
            var connection = new DeviceConnectionRecord(ChipId);

            if (mode == DeviceMode.FullBusy)
            {
                // Confirm rejects FullBusy directly - start FullIdle, then mark busy, so a later
                // MarkIdle() call is provable by the mode flipping back.
                connection.Confirm(ConnectionType.Serial, "COM7", DeviceMode.FullIdle);
                connection.MarkBusy();
            }
            else
            {
                connection.Confirm(ConnectionType.Serial, "COM7", mode);
            }

            var device = new TeensyRomDevice(cart, port, Substitute.For<IStorageService>(), Substitute.For<IStorageService>(), connection);
            _devices.GetAvailableDevice(DeviceId).Returns(device);
            return device;
        }

        private LaunchFileHandler BuildHandler() => new(_log, _recovery, _devices, _interrogator, FastOptions());

        [Fact]
        public async Task Handle_SidLaunch_GoodSIDTokenOnSecondRead_ReturnsSuccessWithoutInterrogatorOrRecovery()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.NewSegment().EnqueueToken(TeensyToken.GoodSIDToken);
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
        }

        [Fact]
        public async Task Handle_PrgLaunch_LoadingTextThenFullVersionReply_ReturnsSuccessAndMarksDeviceBusy()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.NewSegment().EnqueueText("Loading IO handler: TeensyROM");
            var device = BuildDevice(port, DeviceMode.FullIdle);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty with { IsTeensyRom = true, IsMinimalFirmware = false });
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
        }

        /// <summary>
        /// The reported defect's shape: over TCP the firmware's "Loading IO handler:" text never arrives
        /// (it is USB-serial-only), so the watch window sees silence and the version reply says full - but
        /// the running cart still owns the IO handler, so the record must not be called idle.
        /// </summary>
        [Fact]
        public async Task Handle_CartLaunchOverTcp_SilenceThenFullVersionReply_MarksDeviceBusy()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty with { IsTeensyRom = true, IsMinimalFirmware = false });
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/games/5th Gear.crt"), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
        }

        /// <summary>A SID keeps playing under the TeensyROM handler, so the device stays reachable and idle.</summary>
        [Fact]
        public async Task Handle_SidLaunch_SilenceThenFullVersionReply_MarksDeviceIdle()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            var device = BuildDevice(port, DeviceMode.FullBusy);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty with { IsTeensyRom = true, IsMinimalFirmware = false });
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId, "/music/tune.sid"), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
        }

        [Fact]
        public async Task Handle_LargeLaunchOverTcp_SilenceThenEmptyVersionReply_RecoversWithLargeLaunchReason()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty);
            _recovery.RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>())
                .Returns(new RecoveryOutcome(DeviceMode.Minimal, TimeSpan.Zero, TimeSpan.FromSeconds(1), null));
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            _interrogator.Received(1).ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.Received(1).RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>());
        }

        [Fact]
        public async Task Handle_LargeLaunchOverTcp_RecoveryReturnsFullIdle_ReturnsDidNotTakeError()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty);
            _recovery.RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>())
                .Returns(new RecoveryOutcome(DeviceMode.FullIdle, TimeSpan.Zero, TimeSpan.FromSeconds(1), "expected Minimal, device is in FullIdle"));
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            result.LaunchResult.Should().Be(LaunchFileResultType.Error);
            result.Error.Should().Be("The launch did not take: the device came back in full firmware.");
        }

        [Fact]
        public async Task Handle_LargeLaunchOverTcp_RecoveryReturnsUnreachable_ReturnsDisconnected()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            var device = BuildDevice(port, DeviceMode.FullIdle);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty);
            _recovery.RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>())
                .Returns(new RecoveryOutcome(DeviceMode.Unreachable, TimeSpan.Zero, TimeSpan.FromSeconds(1), "no reply"));
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            result.LaunchResult.Should().Be(LaunchFileResultType.Disconnected);
        }

        [Fact]
        public async Task Handle_LargeLaunchOverSerial_PortClosedOnNextRead_RecoversWithoutCallingInterrogator()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);
            port.ThrowOnNextRead(new InvalidOperationException("The port is closed"));
            var device = BuildDevice(port, DeviceMode.FullIdle);
            _recovery.RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>())
                .Returns(new RecoveryOutcome(DeviceMode.Minimal, TimeSpan.Zero, TimeSpan.FromSeconds(1), null));
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port, DeviceId), CancellationToken.None);

            result.LaunchResult.Should().Be(LaunchFileResultType.Success);
            _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
            await _recovery.Received(1).RecoverAsync(device, RecoveryReason.LargeLaunch, Arg.Any<CancellationToken>());
        }

        [Fact]
        public async Task Handle_RetryLaunchToken_ReturnsDeclinedWithoutRecovery()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.RetryLaunch);
            var handler = BuildHandler();

            var result = await handler.Handle(BuildCommand(port), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            result.LaunchResult.Should().Be(LaunchFileResultType.Declined);
            result.Error.Should().NotBeNullOrEmpty();
            await _recovery.DidNotReceive().RecoverAsync(Arg.Any<TeensyRomDevice>(), Arg.Any<RecoveryReason>(), Arg.Any<CancellationToken>());
        }
    }
}
