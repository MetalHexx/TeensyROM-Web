using MediatR;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Commands
{
    public class PingCommandHandler : IRequestHandler<PingCommand, PingResult>
    {
        public Task<PingResult> Handle(PingCommand request, CancellationToken cancellationToken)
        {
            var response = request.CommunicationPort.PingDevice();

            return Task.FromResult(new PingResult 
            {
                Response = response,
                IsBusy = response.Contains("busy", StringComparison.OrdinalIgnoreCase)
            });
        }
    }
}
