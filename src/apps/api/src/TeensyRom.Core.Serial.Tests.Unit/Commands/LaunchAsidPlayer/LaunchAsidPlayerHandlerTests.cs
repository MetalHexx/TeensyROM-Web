using System.Text;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands.LaunchAsidPlayer;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Tests.Unit.Routines;

namespace TeensyRom.Core.Serial.Tests.Unit.Commands.LaunchAsidPlayer
{
    public class LaunchAsidPlayerHandlerTests
    {
        private const string ChipId = "19307720";
        private const string ReportText = "Remote Launch:\nP: /MIDI + ASID\nF: TeensyROM ASID Player    +TR ASID\n";

        private readonly ILoggingService _log = Substitute.For<ILoggingService>();
        private readonly IDeviceConnectionManager _devices = Substitute.For<IDeviceConnectionManager>();

        private LaunchAsidPlayerHandler BuildHandler() => new(_log, _devices, new ConnectionOptions { LaunchSettleMs = 50 });

        /// <summary>The scripted port reports serial, so a network device is a substitute whose writes are asserted absent.</summary>
        private ICommunicationPort BuildTcpDevice()
        {
            var tcpPort = Substitute.For<ICommunicationPort>();
            tcpPort.GetConnectionType().Returns(ConnectionType.Tcp);
            BuildDevice(tcpPort);
            return tcpPort;
        }

        private static void ShouldHaveSentNothing(ICommunicationPort port)
        {
            port.DidNotReceiveWithAnyArgs().ClearBuffers();
            port.DidNotReceiveWithAnyArgs().SendIntBytes(default, default);
            port.DidNotReceiveWithAnyArgs().Write(default(string)!);
        }

        private TeensyRomDevice BuildDevice(ICommunicationPort port, DeviceMode mode = DeviceMode.FullIdle)
        {
            var transport = port.GetConnectionType();
            var connection = new DeviceConnectionRecord(ChipId);
            connection.Confirm(transport, transport == ConnectionType.Tcp ? "10.0.0.5:80" : "COM7", DeviceMode.FullIdle);

            if (mode == DeviceMode.FullBusy)
            {
                connection.MarkBusy();
            }

            var device = new TeensyRomDevice(new Cart { DeviceId = ChipId, Name = "TR-1" }, port, Substitute.For<IStorageService>(), Substitute.For<IStorageService>(), connection);
            _devices.GetAvailableDevice(ChipId).Returns(device);
            return device;
        }

        private static LaunchAsidPlayerCommand BuildCommand(ICommunicationPort port) => new() { DeviceId = ChipId, CommunicationPort = port };

        private static ScriptedCommunicationPort AcceptingPort(string? reportAfterAck = ReportText)
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.Ack);

            if (reportAfterAck is not null)
            {
                port.EnqueueTextAfterQuiet(10, reportAfterAck);
            }

            return port;
        }

        private static byte[] ExpectedLaunchBytes()
        {
            var bytes = new List<byte> { (byte)(TeensyToken.LaunchFile.Value >> 8), (byte)(TeensyToken.LaunchFile.Value & 0xFF), 2 };
            bytes.AddRange(Encoding.Latin1.GetBytes("/MIDI + ASID/TeensyROM ASID Player    +TR ASID\0"));
            return [.. bytes];
        }

        [Fact]
        public async Task Handle_SerialDevice_SendsTheBuiltInMenuLaunchAndSucceedsOnTheReport_LeavingTheDeviceIdle()
        {
            var port = AcceptingPort();
            var device = BuildDevice(port, DeviceMode.FullBusy);

            var result = await BuildHandler().Handle(BuildCommand(port), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.MovedToSerial.Should().BeFalse();
            port.Written.Should().Equal(ExpectedLaunchBytes());
            device.Connection.Mode.Should().Be(DeviceMode.FullIdle);
            await _devices.DidNotReceive().MoveToSerialAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
        }

        [Fact]
        public async Task Handle_TcpDeviceThatMoves_LaunchesOnlyOnTheSerialPort()
        {
            var tcpPort = BuildTcpDevice();
            var serialPort = AcceptingPort();
            var serialDevice = new TeensyRomDevice(new Cart { DeviceId = ChipId }, serialPort, Substitute.For<IStorageService>(), Substitute.For<IStorageService>());
            _devices.MoveToSerialAsync(ChipId, Arg.Any<CancellationToken>()).Returns(new SerialMoveOutcome(SerialMoveResult.Moved, serialDevice));

            var result = await BuildHandler().Handle(BuildCommand(tcpPort), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.MovedToSerial.Should().BeTrue();
            serialPort.Written.Should().Equal(ExpectedLaunchBytes());
            ShouldHaveSentNothing(tcpPort);
        }

        [Fact]
        public async Task Handle_TcpDeviceAlreadyMovedToSerial_LaunchesOnTheSerialPortWithoutReportingAMove()
        {
            var tcpPort = BuildTcpDevice();
            var serialPort = AcceptingPort();
            var serialDevice = new TeensyRomDevice(new Cart { DeviceId = ChipId }, serialPort, Substitute.For<IStorageService>(), Substitute.For<IStorageService>());
            _devices.MoveToSerialAsync(ChipId, Arg.Any<CancellationToken>()).Returns(new SerialMoveOutcome(SerialMoveResult.AlreadyOnSerial, serialDevice));

            var result = await BuildHandler().Handle(BuildCommand(tcpPort), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            result.MovedToSerial.Should().BeFalse();
            serialPort.Written.Should().Equal(ExpectedLaunchBytes());
            ShouldHaveSentNothing(tcpPort);
        }

        [Fact]
        public async Task Handle_SerialUnreachable_FailsAsUsbUnreachableWritingNothing()
        {
            var tcpPort = BuildTcpDevice();
            _devices.MoveToSerialAsync(ChipId, Arg.Any<CancellationToken>()).Returns(new SerialMoveOutcome(SerialMoveResult.SerialUnreachable, null));

            var result = await BuildHandler().Handle(BuildCommand(tcpPort), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            result.UsbUnreachable.Should().BeTrue();
            ShouldHaveSentNothing(tcpPort);
        }

        [Fact]
        public async Task Handle_TransferActive_FailsWithTheJobIdWritingNothing()
        {
            var tcpPort = BuildTcpDevice();
            _devices.MoveToSerialAsync(ChipId, Arg.Any<CancellationToken>()).Returns(new SerialMoveOutcome(SerialMoveResult.TransferActive, null, "job-3"));

            var result = await BuildHandler().Handle(BuildCommand(tcpPort), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            result.ActiveTransferJobId.Should().Be("job-3");
            result.UsbUnreachable.Should().BeFalse();
            ShouldHaveSentNothing(tcpPort);
        }

        [Fact]
        public async Task Handle_DeviceNoLongerAvailable_Fails()
        {
            var port = new ScriptedCommunicationPort();
            _devices.GetAvailableDevice(ChipId).Returns((TeensyRomDevice?)null);

            var result = await BuildHandler().Handle(BuildCommand(port), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            port.Written.Should().BeEmpty();
        }

        [Fact]
        public async Task Handle_FirmwareDeclinesTheLaunch_Fails()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueToken(TeensyToken.RetryLaunch);
            var device = BuildDevice(port, DeviceMode.FullBusy);

            var result = await BuildHandler().Handle(BuildCommand(port), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
        }

        [Fact]
        public async Task Handle_NoReportWithinTheSettleTime_FailsAndLeavesTheDeviceAsItWas()
        {
            var port = AcceptingPort(reportAfterAck: null);
            var device = BuildDevice(port, DeviceMode.FullBusy);

            var result = await BuildHandler().Handle(BuildCommand(port), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            device.Connection.Mode.Should().Be(DeviceMode.FullBusy);
        }

        [Fact]
        public async Task Handle_ReportForADifferentEntry_Fails()
        {
            var port = AcceptingPort("Remote Launch:\nP: /MIDI + ASID\nF: Something Else\n");
            BuildDevice(port);

            var result = await BuildHandler().Handle(BuildCommand(port), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
        }

        [Fact]
        public async Task Handle_ExchangeThrowsAfterAMove_ReturnsAFailedResultInsteadOfThrowing()
        {
            var tcpPort = BuildTcpDevice();
            var silentSerialPort = new ScriptedCommunicationPort();
            var serialDevice = new TeensyRomDevice(new Cart { DeviceId = ChipId }, silentSerialPort, Substitute.For<IStorageService>(), Substitute.For<IStorageService>());
            _devices.MoveToSerialAsync(ChipId, Arg.Any<CancellationToken>()).Returns(new SerialMoveOutcome(SerialMoveResult.Moved, serialDevice));

            var result = await BuildHandler().Handle(BuildCommand(tcpPort), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            result.MovedToSerial.Should().BeTrue();
        }

        [Fact]
        public async Task Handle_SerialDeviceWhoseLivePortIsNotTheCommandsPort_LaunchesOnTheLivePortAndContainsFailures()
        {
            var retiredTcpPort = BuildTcpDevice();
            var silentSerialPort = new ScriptedCommunicationPort();
            BuildDevice(silentSerialPort);

            var result = await BuildHandler().Handle(BuildCommand(retiredTcpPort), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            ShouldHaveSentNothing(retiredTcpPort);
            silentSerialPort.Written.Should().NotBeEmpty();
        }

        [Fact]
        public async Task Handle_ExchangeThrowsOnTheCommandsOwnPort_Propagates()
        {
            var silentPort = new ScriptedCommunicationPort();
            BuildDevice(silentPort);

            var act = () => BuildHandler().Handle(BuildCommand(silentPort), CancellationToken.None);

            await act.Should().ThrowAsync<Exception>();
        }

        [Fact]
        public void FirmwareNames_MatchTheFirmwareLiterals_AndTheBuiltInMenuStaysOutOfStorage()
        {
            AsidPlayerEntry.BuiltInMenuDrive.Should().Be(2u);
            AsidPlayerEntry.Path.Should().Be("/MIDI + ASID/TeensyROM ASID Player    +TR ASID");
            Enum.GetValues<TeensyStorageType>().Should().Equal(TeensyStorageType.SD, TeensyStorageType.USB);
        }
    }
}
