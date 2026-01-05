using MediatR;
using TeensyRom.Core.Commands.MuteSidVoices;
using TeensyRom.Core.Commands.PlaySubtune;
using TeensyRom.Core.Common;
using TeensyRom.Core.Music;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial.Commands.Composite.EndSeek
{
    public class EndSeekHandler() : IRequestHandler<EndSeekCommand, EndSeekResult>
    {
        public async Task<EndSeekResult> Handle(EndSeekCommand request, CancellationToken cancellationToken)
        {
            try
            {
                await request.CommunicationPort.SetSidSpeed(request.SeekSpeed, request.SpeedCurve);

                if (request.ShouldEnableVoices)
                {
                    await request.CommunicationPort.ToggleSidVoices(VoiceState.Enabled, VoiceState.Enabled, VoiceState.Enabled);
                }
            }
            catch (TeensyException ex)
            {
                return new EndSeekResult
                {
                    IsSuccess = false,
                    Error = ex.Message
                };
            }
            return new EndSeekResult();
        }
    }
}
