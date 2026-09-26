using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial.Tests.Unit.Routines
{
    /// <summary>
    /// The reset primitive's contract: it owns the C64 menu's boot-time SID token, so no command that
    /// follows a reset ever meets it.
    /// </summary>
    public class TRStreamExtensionsTests
    {
        private const string ResetText = "\r\nResetting C64...\r\n";

        private const string VersionText =
            "\n  FW: TeensyROM+ v0.8.0.11\r\n      Sep 23 2026, 22:45:10\r\n  Teensy: 816MHz  59.1C  UID: 19307720\r\n  C64  PAL Vid  50 Hz\n";

        private readonly ILoggingService _log = Substitute.For<ILoggingService>();

        /// <summary>A port whose reset text is already readable, as the gate leaves it (it clears buffers before the command).</summary>
        private static ScriptedCommunicationPort PortEchoingResetText()
        {
            var port = new ScriptedCommunicationPort();
            port.EnqueueText(ResetText);
            port.ClearBuffers();
            return port;
        }

        [Theory]
        [InlineData(0x9B81)] // GoodSIDToken - the menu loaded its default SID
        [InlineData(0x9B80)] // BadSIDToken - it tried and failed; either way the menu is up and the token is on the wire
        public void ResetDevice_SidTokenArrivesLongAfterTheResetTextGoesQuiet_ConsumesItAndLeavesNothingBehind(int tokenValue)
        {
            var port = PortEchoingResetText();
            port.EnqueueAfterQuiet(650, (byte)(tokenValue & 0xFF), (byte)(tokenValue >> 8));
            port.NewSegment(); // what the token wait's own buffer clear moves onto
            EnqueueVersionReply(port, "complete");

            var menuCameUp = port.ResetDevice(_log);

            menuCameUp.Should().BeTrue();
            port.BytesToRead.Should().Be(0, "a token left in the buffer is read as the next command's Ack");
        }

        [Fact]
        public void ResetDevice_SendsTheResetToken()
        {
            var port = PortEchoingResetText();
            port.EnqueueTokenAfterQuiet(650, TeensyToken.GoodSIDToken);
            port.NewSegment();
            EnqueueVersionReply(port, "complete");

            port.ResetDevice(_log);

            port.Written.Take(2).Should().Equal(0x64, 0xEE);
        }

        [Fact]
        public void ResetDevice_SidTokenArrivesAfterTheBound_ReportsTheTimeoutInsteadOfSuccess()
        {
            var port = PortEchoingResetText();
            port.EnqueueTokenAfterQuiet(4000, TeensyToken.GoodSIDToken);

            var menuCameUp = port.ResetDevice(_log, menuBootTimeoutMs: 3000);

            menuCameUp.Should().BeFalse();
            _log.Received().InternalWarning(Arg.Is<string>(m => m.Contains("menu did not come up")), Arg.Any<string?>());
        }

        /// <summary>Scripts one version reply as its own segment: the poll clears the buffers before each request.</summary>
        private static void EnqueueVersionReply(ScriptedCommunicationPort port, string bootState) =>
            port.NewSegment().EnqueueToken(TeensyToken.Ack).EnqueueText($"{VersionText}  Boot: {bootState}\n");

        [Fact]
        public void ResetDevice_WaitsPastTheSidTokenUntilBootComplete()
        {
            var port = PortEchoingResetText();
            port.EnqueueTokenAfterQuiet(650, TeensyToken.GoodSIDToken);
            port.NewSegment(); // what the token wait's own buffer clear moves onto
            EnqueueVersionReply(port, "in progress");
            EnqueueVersionReply(port, "complete");

            var ready = port.ResetDevice(_log);

            ready.Should().BeTrue();
            port.Written.Should().Equal(0x64, 0xEE, 0x64, 0x76, 0x64, 0x76);
        }

        [Fact]
        public void WaitForBootComplete_NeverComplete_ReportsTheTimeout()
        {
            var port = new ScriptedCommunicationPort();
            EnqueueVersionReply(port, "in progress");

            var complete = port.WaitForBootComplete(_log, timeoutMs: 300);

            complete.Should().BeFalse();
            _log.Received().InternalWarning(Arg.Is<string>(m => m.Contains("did not report its boot complete")), Arg.Any<string?>());
        }

        [Fact]
        public void ResetFromMinimal_SendsTheResetTokenAndReadsNothing()
        {
            var port = PortEchoingResetText();

            port.ResetFromMinimal(_log);

            port.Written.Should().Equal(0x64, 0xEE);
            port.BytesToRead.Should().Be(ResetText.Length, "the Teensy reboots: nothing on this connection is worth waiting for");
        }

        [Fact]
        public void ResetDevice_NoSidTokenAtAll_ReportsTheTimeoutInsteadOfSuccess()
        {
            var port = PortEchoingResetText();

            var menuCameUp = port.ResetDevice(_log);

            menuCameUp.Should().BeFalse();
            _log.Received().InternalWarning(Arg.Is<string>(m => m.Contains("menu did not come up")), Arg.Any<string?>());
        }
    }
}
