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

            var menuCameUp = port.ResetDevice(_log);

            menuCameUp.Should().BeTrue();
            port.BytesToRead.Should().Be(0, "a token left in the buffer is read as the next command's Ack");
        }

        [Fact]
        public void ResetDevice_SendsTheResetToken()
        {
            var port = PortEchoingResetText();
            port.EnqueueTokenAfterQuiet(650, TeensyToken.GoodSIDToken);

            port.ResetDevice(_log);

            port.Written.Should().Equal(0x64, 0xEE);
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
