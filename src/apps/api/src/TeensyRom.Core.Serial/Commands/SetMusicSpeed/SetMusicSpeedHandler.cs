using MediatR;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Commands.SetMusicSpeed
{
    public class SetMusicSpeedHandler : IRequestHandler<SetMusicSpeedCommand, SetMusicSpeedResult>
    {
        public async Task<SetMusicSpeedResult> Handle(SetMusicSpeedCommand request, CancellationToken cancellationToken)
        {
            await request.CommunicationPort.SetSidSpeed(request.Speed, request.Type);
            return new SetMusicSpeedResult();
        }
    }
}
