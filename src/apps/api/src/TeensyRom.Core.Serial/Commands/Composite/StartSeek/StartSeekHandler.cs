using MediatR;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Commands.MuteSidVoices;
using TeensyRom.Core.Common;
using TeensyRom.Core.Music;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial.Commands.Composite.StartSeek
{
  public class StartSeekHandler() : IRequestHandler<StartSeekCommand, StartSeekResult>
  {
    public async Task<StartSeekResult> Handle(StartSeekCommand request, CancellationToken cancellationToken)
    {
      try
      {
        if (request.ShouldTogglePlay)
        {
          request.CommunicationPort.ToggleSid();
        }
        if (request.Direction is SeekDirection.Backward)
        {
          request.CommunicationPort.PlaySubtune((uint)request.SubtuneIndex);
        }
        if (request.ShouldMuteVoices)
        {
          await request.CommunicationPort.ToggleSidVoices(VoiceState.Disabled, VoiceState.Disabled, VoiceState.Disabled);
        }
        await request.CommunicationPort.SetSidSpeed(request.SeekSpeed, MusicSpeedCurveTypes.Logarithmic);
      }
      catch (TeensyException ex)
      {
        return new StartSeekResult
        {
          IsSuccess = false,
          Error = ex.Message
        };
      }
      return new StartSeekResult();
    }
  }
}
