using TeensyRom.Core.Serial.Routines;
using TeensyRom.Core.Themes;

namespace TeensyRom.Core.Serial.Tests.Unit.Routines
{
    public class SetColorRoutineTests
    {
        [Fact]
        public void SetColor_WritesTokenSlotAndColor_AndReturnsOnAck()
        {
            var port = new ScriptedCommunicationPort().NewSegment().EnqueueToken(TeensyToken.Ack);

            port.SetColor(ColorSlot.Banner, 12);

            port.Written.Should().Equal(0x64, 0x22, 0x02, 0x0C);
        }

        [Fact]
        public void SetColor_FailReply_RaisesTeensyException()
        {
            var port = new ScriptedCommunicationPort().NewSegment().EnqueueToken(TeensyToken.Fail);

            var act = () => port.SetColor(ColorSlot.Background, 3);

            act.Should().Throw<TeensyException>();
        }

        [Theory]
        [InlineData(ColorSlot.Background, 16u)]
        [InlineData((ColorSlot)7, 0u)]
        [InlineData((ColorSlot)(-1), 0u)]
        public void SetColor_OutOfRange_ThrowsBeforeAnythingIsWritten(ColorSlot slot, uint color)
        {
            var port = new ScriptedCommunicationPort().NewSegment().EnqueueToken(TeensyToken.Ack);

            var act = () => port.SetColor(slot, color);

            act.Should().Throw<ArgumentOutOfRangeException>();
            port.Written.Should().BeEmpty();
        }
    }
}
