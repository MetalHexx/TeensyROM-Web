using MediatR;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Commands.MuteSidVoices;
using TeensyRom.Core.Common;
using TeensyRom.Core.Music;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial.Commands.Composite.FastForward
{
    public class FastForwardHandler() : IRequestHandler<FastForwardCommand, FastForwardResult>
    {
        public async Task<FastForwardResult> Handle(FastForwardCommand request, CancellationToken cancellationToken)
        {
            try
            {
                if (request.ShouldTogglePlay)
                {
                  request.CommunicationPort.ToggleSid();
                }
                if (request.ShouldMuteVoices)
                {
                    await request.CommunicationPort.ToggleSidVoices(VoiceState.Disabled, VoiceState.Disabled, VoiceState.Disabled);
                }
                await request.CommunicationPort.SetSidSpeed(request.Speed, MusicSpeedCurveTypes.Logarithmic);
            }
            catch (TeensyException ex)
            {
                return new FastForwardResult
                {
                    IsSuccess = false,
                    Error = ex.Message
                };
            }
            return new FastForwardResult();
        }
    }
}
