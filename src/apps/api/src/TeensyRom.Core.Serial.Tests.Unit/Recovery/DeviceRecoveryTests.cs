using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Routines;
using TeensyRom.Core.Serial.Usb;

namespace TeensyRom.Core.Serial.Tests.Unit.Recovery
{
    public class DeviceRecoveryTests
    {
        private const string ChipId = "19307720";

        private readonly IDeviceInterrogator _interrogator = Substitute.For<IDeviceInterrogator>();
        private readonly ITeensyPortLocator _locator = Substitute.For<ITeensyPortLocator>();
        private readonly ILoggingService _log = Substitute.For<ILoggingService>();

        private static (TeensyRomDevice Device, RecoveryScriptedPort Port) BuildDevice(string endpoint = "10.0.0.5:6464", ConnectionType connectionType = ConnectionType.Tcp)
        {
            var port = new RecoveryScriptedPort { ConnectionType = connectionType };
            port.SetPort(endpoint);

            var cart = new Cart { DeviceId = ChipId };
            var device = new TeensyRomDevice(cart, port, Substitute.For<IStorageService>(), Substitute.For<IStorageService>());

            return (device, port);
        }

        private static ConnectionOptions FastOptions(int toMinimalMs = 2000, int toFullMs = 2000, int launchSettleMs = 5) => new()
        {
            PollIntervalMs = 1,
            Tcp = new TransportCeilings { ToMinimalMs = toMinimalMs, ToFullMs = toFullMs },
            Serial = new TransportCeilings { ToMinimalMs = toMinimalMs, ToFullMs = toFullMs },
            LaunchSettleMs = launchSettleMs,
            ConnectTimeoutMs = 50
        };

        private static VersionReply CorrectChip(bool minimal) => VersionReply.Empty with
        {
            IsTeensyRom = true,
            ChipId = ChipId,
            IsMinimalFirmware = minimal
        };

        /// <summary>A full reply saying the C64 menu is done booting, so leaving minimal needs no boot wait.</summary>
        private static VersionReply BootedFull() => CorrectChip(minimal: false) with { BootComplete = true };

        private static readonly VersionReply Miss = VersionReply.Empty;
        private static readonly VersionReply WrongChip = VersionReply.Empty with { IsTeensyRom = true, ChipId = "other" };

        [Fact]
        public async Task RecoverAsync_LargeLaunch_ConnectFailsThenSucceeds_ReturnsMinimalAndConfirmsWithoutProbingStorage()
        {
            var (device, port) = BuildDevice();
            port.ThenTimeOut().ThenTimeOut().ThenTimeOut().ThenSucceed();
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(CorrectChip(minimal: true));
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.LargeLaunch, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.Minimal);
            device.Connection.Mode.Should().Be(DeviceMode.Minimal);
            device.Cart.IsMinimalFirmware.Should().BeTrue();
            _interrogator.DidNotReceive().ProbeStorage(Arg.Any<ICommunicationPort>(), Arg.Any<TeensyStorageType>());
        }

        [Fact]
        public async Task RecoverAsync_NeverAnswers_ReturnsUnreachableWithEndpointsIntactAndClosesPortWithoutDisposing()
        {
            var (device, port) = BuildDevice(endpoint: "10.0.0.5:6464");
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(Miss);
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(toMinimalMs: 15, toFullMs: 15), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.Drop, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.Unreachable);
            outcome.Reachable.Should().BeFalse();
            device.Connection.Mode.Should().Be(DeviceMode.Unreachable);
            device.Connection.TcpEndpoint.Should().Be("10.0.0.5:6464");
            port.IsOpen.Should().BeFalse();
            port.Disposed.Should().BeFalse();
        }

        [Fact]
        public async Task RecoverAsync_WrongChipThenRightChip_LogsWrongChipAndSucceedsOnTheNextProbe()
        {
            var (device, port) = BuildDevice();
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(WrongChip, CorrectChip(minimal: false));
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.Drop, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullIdle);
            _log.Received().Internal(Arg.Is<string>(s => s.Contains("wrong chip")), Arg.Any<string?>());
        }

        [Fact]
        public async Task RecoverAsync_LeaveMinimal_AlwaysMinimal_RunsToCeilingAndReturnsMinimalWithFailureConfirmed()
        {
            var (device, port) = BuildDevice();
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(CorrectChip(minimal: true));
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(toFullMs: 15), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.Minimal);
            outcome.Failure.Should().NotBeNull();
            device.Connection.Mode.Should().Be(DeviceMode.Minimal);
        }

        [Fact]
        public async Task RecoverAsync_LeaveMinimal_FullAnswerAlreadyBootComplete_NeedsNoMenuSidToken()
        {
            var (device, _) = BuildDevice();
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(BootedFull());
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullIdle);
            outcome.Failure.Should().BeNull("the reply itself says the menu is done booting");
        }

        [Fact]
        public async Task RecoverAsync_Drop_FullAnswerWithoutMenuSidToken_DoesNotWaitOnAMenuItNeverReset()
        {
            var (device, port) = BuildDevice();
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(CorrectChip(minimal: false));
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.Drop, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullIdle);
            outcome.Failure.Should().BeNull();
        }

        [Fact]
        public async Task RecoverAsync_Serial_FirstCandidateOpensButAnswersNothing_SecondAnswersCorrectly_AcceptsTheSecondWithinOnePollCycle()
        {
            var (device, port) = BuildDevice(endpoint: "COM5", connectionType: ConnectionType.Serial);
            port.ThenSucceed().ThenSucceed();
            _locator.FindByChipId(ChipId).Returns(new PortLookup(
                [new TeensyRomPort("COM4", ChipId, TeensyRomImage.Minimal), new TeensyRomPort("COM7", ChipId, TeensyRomImage.Full)],
                true, null));
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(Miss, CorrectChip(minimal: false));
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.Drop, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullIdle);
            device.Connection.SerialPortName.Should().Be("COM7");
            _interrogator.Received(2).ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>());
        }

        [Fact]
        public async Task RecoverAsync_Serial_AllCandidatesFailToOpen_ReturnsAMissAndPollsAgainRatherThanAborting()
        {
            var (device, port) = BuildDevice(endpoint: "COM5", connectionType: ConnectionType.Serial);
            port.ThenTimeOut().ThenTimeOut().ThenSucceed();
            _locator.FindByChipId(ChipId).Returns(new PortLookup(
                [new TeensyRomPort("COM4", ChipId, TeensyRomImage.Minimal), new TeensyRomPort("COM7", ChipId, TeensyRomImage.Full)],
                true, null));
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(CorrectChip(minimal: false));
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.Drop, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullIdle);
        }

        [Fact]
        public async Task RecoverAsync_Serial_LeaveMinimal_TransientMinimalPortVanishesOnClose_IsAMissAndTheNextPollFindsFull()
        {
            var (device, port) = BuildDevice(endpoint: "COM7", connectionType: ConnectionType.Serial);
            port.ThenCloseVanishes().EnqueueToken(TeensyToken.GoodSIDToken);
            _locator.FindByChipId(ChipId).Returns(
                new PortLookup([new TeensyRomPort("COM7", ChipId, TeensyRomImage.Minimal)], true, null),
                new PortLookup([new TeensyRomPort("COM4", ChipId, TeensyRomImage.Full)], true, null));
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(Miss, BootedFull());
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullIdle);
            outcome.Failure.Should().BeNull();
            device.Connection.SerialPortName.Should().Be("COM4");
        }

        [Fact]
        public async Task RecoverAsync_Serial_LeaveMinimal_ProbesTheFullImagePortBeforeTheMinimalOne()
        {
            var (device, port) = BuildDevice(endpoint: "COM7", connectionType: ConnectionType.Serial);
            port.EnqueueToken(TeensyToken.GoodSIDToken);
            _locator.FindByChipId(ChipId).Returns(new PortLookup(
                [new TeensyRomPort("COM7", ChipId, TeensyRomImage.Minimal), new TeensyRomPort("COM4", ChipId, TeensyRomImage.Full)],
                true, null));
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(BootedFull());
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullIdle);
            device.Connection.SerialPortName.Should().Be("COM4");
            _interrogator.Received(1).ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>());
        }

        /// <summary>
        /// The full port appears just before the firmware resets the C64 and the menu copies itself into C64
        /// RAM; a request answered then can corrupt the copy. So the full port is only listened to until the
        /// menu's SID token, and the version request after it waits out the network start that follows.
        /// </summary>
        [Fact]
        public async Task RecoverAsync_Serial_LeaveMinimal_ListensForTheMenuTokenBeforeAskingTheFullPortItsVersion()
        {
            var (device, port) = BuildDevice(endpoint: "COM7", connectionType: ConnectionType.Serial);
            port.EnqueueToken(TeensyToken.GoodSIDToken);
            _locator.FindByChipId(ChipId).Returns(new PortLookup([new TeensyRomPort("COM4", ChipId, TeensyRomImage.Full)], true, null));
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(_ =>
            {
                port.BytesToRead.Should().Be(0, "the token is heard and consumed before any request goes out");
                return BootedFull();
            });
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullIdle);
            outcome.Failure.Should().BeNull();
            _interrogator.Received(1).ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Is<int>(ms => ms > TRDiscoveryRoutines.VersionAckTimeoutMs));
        }

        [Fact]
        public async Task RecoverAsync_Serial_LeaveMinimal_NoTokenWithinTheListen_AsksAnywayWithTheUsualAckTimeout()
        {
            var (device, port) = BuildDevice(endpoint: "COM7", connectionType: ConnectionType.Serial);
            _locator.FindByChipId(ChipId).Returns(new PortLookup([new TeensyRomPort("COM4", ChipId, TeensyRomImage.Full)], true, null));
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(BootedFull());
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullIdle);
            outcome.Failure.Should().BeNull();
            _interrogator.Received(1).ReadVersion(Arg.Any<ICommunicationPort>(), TRDiscoveryRoutines.VersionAckTimeoutMs);
        }

        [Fact]
        public async Task RecoverAsync_Serial_LeaveMinimal_PortVanishesWhileListening_IsAMissAndTheNextPollListensAgain()
        {
            var (device, port) = BuildDevice(endpoint: "COM7", connectionType: ConnectionType.Serial);
            port.ThenWaitVanishes().EnqueueToken(TeensyToken.GoodSIDToken);
            _locator.FindByChipId(ChipId).Returns(new PortLookup([new TeensyRomPort("COM4", ChipId, TeensyRomImage.Full)], true, null));
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(BootedFull());
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullIdle);
            outcome.Failure.Should().BeNull();
            _interrogator.Received(1).ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>());
        }

        [Fact]
        public async Task RecoverAsync_FullWithUnknownSdAndPresentUsb_PreservesSdAndWritesUsb()
        {
            var (device, port) = BuildDevice();
            device.Cart.SdStorage.Available = true;
            device.Cart.UsbStorage.Available = false;
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(CorrectChip(minimal: false));
            _interrogator.ProbeStorage(Arg.Any<ICommunicationPort>(), TeensyStorageType.SD).Returns(StoragePresence.Unknown);
            _interrogator.ProbeStorage(Arg.Any<ICommunicationPort>(), TeensyStorageType.USB).Returns(StoragePresence.Present);
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            await recovery.RecoverAsync(device, RecoveryReason.Drop, CancellationToken.None);

            device.Cart.SdStorage.Available.Should().BeTrue();
            device.Cart.UsbStorage.Available.Should().BeTrue();
        }

        [Fact]
        public async Task RecoverAsync_FullWithAbsentSd_OverwritesAPreviouslyTrueAvailability()
        {
            var (device, port) = BuildDevice();
            device.Cart.SdStorage.Available = true;
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(CorrectChip(minimal: false));
            _interrogator.ProbeStorage(Arg.Any<ICommunicationPort>(), TeensyStorageType.SD).Returns(StoragePresence.Absent);
            _interrogator.ProbeStorage(Arg.Any<ICommunicationPort>(), TeensyStorageType.USB).Returns(StoragePresence.Absent);
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            await recovery.RecoverAsync(device, RecoveryReason.Drop, CancellationToken.None);

            device.Cart.SdStorage.Available.Should().BeFalse();
        }

        [Fact]
        public async Task RecoverAsync_FullThenStorageBusy_MarksFullBusyAndLeavesStorageAvailabilityUnchanged()
        {
            var (device, port) = BuildDevice();
            device.Cart.SdStorage.Available = true;
            device.Cart.UsbStorage.Available = false;
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>(), Arg.Any<int>()).Returns(CorrectChip(minimal: false));
            _interrogator.ProbeStorage(Arg.Any<ICommunicationPort>(), TeensyStorageType.SD).Returns(StoragePresence.Busy);
            _interrogator.ProbeStorage(Arg.Any<ICommunicationPort>(), TeensyStorageType.USB).Returns(StoragePresence.Present);
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.Drop, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullBusy);
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
            device.Cart.SdStorage.Available.Should().BeTrue();
            device.Cart.UsbStorage.Available.Should().BeFalse();
        }
    }
}
