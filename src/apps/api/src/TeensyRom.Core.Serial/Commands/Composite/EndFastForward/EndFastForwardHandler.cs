using MediatR;
using TeensyRom.Core.Commands.MuteSidVoices;
using TeensyRom.Core.Common;
using TeensyRom.Core.Music;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial.Commands.Composite.EndFastForward
{
    public class EndFastForwardHandler() : IRequestHandler<EndFastForwardCommand, EndFastForwardResult>
    {
        public async Task<EndFastForwardResult> Handle(EndFastForwardCommand request, CancellationToken cancellationToken)
        {
            try
            {
                if (request.ShouldEnableVoices)
                {
                    await request.CommunicationPort.ToggleSidVoices(VoiceState.Enabled, VoiceState.Enabled, VoiceState.Enabled);
                }
                await request.CommunicationPort.SetSidSpeed(request.OriginalSpeed, MusicSpeedCurveTypes.Logarithmic);
            }
            catch (TeensyException ex)
            {
                return new EndFastForwardResult
                {
                    IsSuccess = false,
                    Error = ex.Message
                };
            }
            return new EndFastForwardResult();
        }
    }
}
