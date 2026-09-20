using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial.Tests.Unit.Routines
{
    public class TRDiscoveryRoutinesTests
    {
        private const string FullVersionReply =
            "\n  FW: TeensyROM+ v0.8.0.9\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  59.1C  UID: 19307720\r\n  C128  NTSC Vid  60 Hz\n";

        private readonly ILoggingService _log = Substitute.For<ILoggingService>();

        // ReadVersionReply ----------------------------------------------------------------------

        [Fact]
        public void ReadVersionReply_AckThenFullText_ReturnsTextWithNoLeadingTokenBytes()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueText(FullVersionReply);

            var result = port.ReadVersionReply(_log);

            result.Should().Be(FullVersionReply);
        }

        [Fact]
        public void ReadVersionReply_AckThenFullText_InterrogatorYieldsChipId()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueText(FullVersionReply);
            var interrogator = new DeviceInterrogator(_log);

            var reply = interrogator.ReadVersion(port);

            reply.ChipId.Should().Be("19307720");
        }

        [Fact]
        public void ReadVersionReply_NoReply_ReturnsEmptyStringWithoutThrowing()
        {
            var port = new ScriptedCommunicationPort();

            // An unhandled exception here would fail the test - this is the "without throwing" half.
            var result = port.ReadVersionReply(_log);

            result.Should().BeEmpty();
        }

        [Fact]
        public void ReadVersionReply_NoReply_InterrogatorYieldsNotTeensyRom()
        {
            var port = new ScriptedCommunicationPort();
            var interrogator = new DeviceInterrogator(_log);

            var reply = interrogator.ReadVersion(port);

            reply.IsTeensyRom.Should().BeFalse();
        }

        [Fact]
        public void ReadVersionReply_ReplyContainsNullBytes_StripsThemFromTheReturnedText()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack).EnqueueText("FW: TeensyROM+ v0.8.0.9\0\0trailer");

            var result = port.ReadVersionReply(_log);

            result.Should().Be("FW: TeensyROM+ v0.8.0.9trailer");
        }

        // ProbeStorageRoot ----------------------------------------------------------------------

        [Fact]
        public void ProbeStorageRoot_AckAckStartEnd_ReturnsPresent()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack)
                .EnqueueToken(TeensyToken.Ack)
                .EnqueueToken(TeensyToken.StartDirectoryList)
                .EnqueueToken(TeensyToken.EndDirectoryList);

            var result = port.ProbeStorageRoot(TeensyStorageType.SD, _log);

            result.Should().Be(StoragePresence.Present);
        }

        [Fact]
        public void ProbeStorageRoot_AckThenFailStorageNotFound_ReturnsAbsent()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack)
                .EnqueueToken(TeensyToken.Fail)
                .EnqueueText("Specified storage device was not found: 1");

            var result = port.ProbeStorageRoot(TeensyStorageType.SD, _log);

            result.Should().Be(StoragePresence.Absent);
        }

        [Fact]
        public void ProbeStorageRoot_AckThenFailDirectoryNotFound_ReturnsAbsent()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack)
                .EnqueueToken(TeensyToken.Fail)
                .EnqueueText("Directory not found. (Error 5)");

            var result = port.ProbeStorageRoot(TeensyStorageType.USB, _log);

            result.Should().Be(StoragePresence.Absent);
        }

        [Fact]
        public void ProbeStorageRoot_FailBusyOnFirstAck_ReturnsUnknown()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Fail).EnqueueText("Busy!");

            var result = port.ProbeStorageRoot(TeensyStorageType.SD, _log);

            result.Should().Be(StoragePresence.Unknown);
        }

        [Fact]
        public void ProbeStorageRoot_AckThenFailProtocolFault_ReturnsUnknownNotAbsent()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack)
                .EnqueueToken(TeensyToken.Fail)
                .EnqueueText("Path is not a directory. (Error 6)");

            var result = port.ProbeStorageRoot(TeensyStorageType.SD, _log);

            result.Should().Be(StoragePresence.Unknown);
        }

        [Fact]
        public void ProbeStorageRoot_TimeoutAfterParameters_ReturnsUnknown()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack); // only the first ack is scripted; nothing follows

            var result = port.ProbeStorageRoot(TeensyStorageType.SD, _log);

            result.Should().Be(StoragePresence.Unknown);
        }

        [Fact]
        public void ProbeStorageRoot_AckAckThenUnexpectedPair_ReturnsUnknown()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack)
                .EnqueueToken(TeensyToken.Ack)
                .EnqueueToken(TeensyToken.Ack)
                .EnqueueToken(TeensyToken.Fail);

            var result = port.ProbeStorageRoot(TeensyStorageType.SD, _log);

            result.Should().Be(StoragePresence.Unknown);
        }

        [Fact]
        public void ProbeStorageRoot_WritesTheWireSequenceInOrder()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueToken(TeensyToken.Ack)
                .EnqueueToken(TeensyToken.Ack)
                .EnqueueToken(TeensyToken.StartDirectoryList)
                .EnqueueToken(TeensyToken.EndDirectoryList);

            port.ProbeStorageRoot(TeensyStorageType.SD, _log);

            port.Written.Should().Equal(
                0x64, 0xDE,                     // ListDirectory, MSB first
                (byte)TeensyStorageType.SD.GetStorageToken(), // storage token byte
                0x00, 0x00,                     // skip
                0x00, 0x00,                     // take
                (byte)'/', 0x00);                // path + null terminator
        }
    }
}
