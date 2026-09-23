using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
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

        private static (TeensyRomDevice Device, RecoveryScriptedPort Port) BuildDevice(string endpoint = "10.0.0.5:6464")
        {
            var port = new RecoveryScriptedPort();
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

        private static readonly VersionReply Miss = VersionReply.Empty;
        private static readonly VersionReply WrongChip = VersionReply.Empty with { IsTeensyRom = true, ChipId = "other" };

        [Fact]
        public async Task RecoverAsync_LargeLaunch_ConnectFailsThenSucceeds_ReturnsMinimalAndConfirmsWithoutProbingStorage()
        {
            var (device, port) = BuildDevice();
            port.ThenTimeOut().ThenTimeOut().ThenTimeOut().ThenSucceed();
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(CorrectChip(minimal: true));
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
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(Miss);
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
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(WrongChip, CorrectChip(minimal: false));
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.Drop, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullIdle);
            _log.Received().Internal(Arg.Is<string>(s => s.Contains("wrong chip")), Arg.Any<string?>());
        }

        [Fact]
        public async Task RecoverAsync_LeaveMinimal_AlwaysMinimal_RunsToCeilingAndReturnsMinimalWithFailureConfirmed()
        {
            var (device, port) = BuildDevice();
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(CorrectChip(minimal: true));
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(toFullMs: 15), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.Minimal);
            outcome.Failure.Should().NotBeNull();
            device.Connection.Mode.Should().Be(DeviceMode.Minimal);
        }

        /// <summary>
        /// The reset that started this recovery rebooted the Teensy and dropped the transport, so it could
        /// not consume the C64 menu's boot SID token itself. Recovery has to, before the device is declared
        /// full - otherwise the token lands on the next command as a bogus Ack.
        /// </summary>
        [Fact]
        public async Task RecoverAsync_LeaveMinimal_FullAnswerThenMenuSidToken_ConsumesTheTokenAndReportsNoFailure()
        {
            var (device, port) = BuildDevice();
            port.EnqueueToken(TeensyToken.GoodSIDToken);
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(CorrectChip(minimal: false));
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullIdle);
            outcome.Failure.Should().BeNull();
            port.BytesToRead.Should().Be(0);
        }

        [Fact]
        public async Task RecoverAsync_LeaveMinimal_FullAnswerWithoutMenuSidToken_ReportsTheMissAsAFailure()
        {
            var (device, port) = BuildDevice();
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(CorrectChip(minimal: false));
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.LeaveMinimal, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullIdle);
            outcome.Failure.Should().NotBeNull();
        }

        [Fact]
        public async Task RecoverAsync_Drop_FullAnswerWithoutMenuSidToken_DoesNotWaitOnAMenuItNeverReset()
        {
            var (device, port) = BuildDevice();
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(CorrectChip(minimal: false));
            var recovery = new DeviceRecovery(_interrogator, _locator, FastOptions(), _log);

            var outcome = await recovery.RecoverAsync(device, RecoveryReason.Drop, CancellationToken.None);

            outcome.Mode.Should().Be(DeviceMode.FullIdle);
            outcome.Failure.Should().BeNull();
        }

        [Fact]
        public async Task RecoverAsync_FullThenStorageBusy_MarksFullBusyAndLeavesStorageAvailabilityUnchanged()
        {
            var (device, port) = BuildDevice();
            device.Cart.SdStorage.Available = true;
            device.Cart.UsbStorage.Available = false;
            _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(CorrectChip(minimal: false));
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
