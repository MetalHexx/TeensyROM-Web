using TeensyRom.Core.Serial.Commands.SetColor;
using TeensyRom.Core.Serial.Tests.Unit.Routines;
using TeensyRom.Core.Themes;

namespace TeensyRom.Core.Serial.Tests.Unit.Commands.SetColor
{
    public class SetColorHandlerTests
    {
        private static SetColorCommand CommandOn(ScriptedCommunicationPort port) =>
            new() { CommunicationPort = port, Slot = ColorSlot.Border, Color = 5 };

        [Fact]
        public async Task Handle_AckReply_Succeeds()
        {
            var port = new ScriptedCommunicationPort().NewSegment().EnqueueToken(TeensyToken.Ack);

            var result = await new SetColorHandler().Handle(CommandOn(port), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            port.Written.Should().Equal(0x64, 0x22, 0x01, 0x05);
        }

        [Fact]
        public async Task Handle_FailReply_PropagatesTeensyExceptionToThePipeline()
        {
            var port = new ScriptedCommunicationPort().NewSegment().EnqueueToken(TeensyToken.Fail);

            var act = () => new SetColorHandler().Handle(CommandOn(port), CancellationToken.None);

            await act.Should().ThrowAsync<TeensyException>();
        }
    }
}
