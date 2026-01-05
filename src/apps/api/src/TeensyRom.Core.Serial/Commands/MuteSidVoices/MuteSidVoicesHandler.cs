using MediatR;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Commands.MuteSidVoices
{
    public class MuteSidVoicesHandler() : IRequestHandler<MuteSidVoicesCommand, MuteSidVoicesResult>
    {
        public async Task<MuteSidVoicesResult> Handle(MuteSidVoicesCommand request, CancellationToken cancellationToken)
        {
            await request.CommunicationPort.ToggleSidVoices(request.Voice1Enabled, request.Voice2Enabled, request.Voice3Enabled);
            return new MuteSidVoicesResult();
        }
    }
}
