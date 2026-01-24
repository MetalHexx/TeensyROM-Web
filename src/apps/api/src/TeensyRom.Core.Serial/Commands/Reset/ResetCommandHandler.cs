using MediatR;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Commands
{
    public class ResetCommandHandler(ILoggingService log) : IRequestHandler<ResetCommand, ResetResult>
    {        
        public async Task<ResetResult> Handle(ResetCommand request, CancellationToken cancellationToken)
        {
			var resetResult = request.CommunicationPort.ForceResetAndReconnectToFullFw(log);
			await Task.CompletedTask;

            return resetResult
                ? new ResetResult()
                : new ResetResult 
                {
                    IsSuccess = false,
                    Error = "Failed to reset device.  Check to make sure you're using the correct com port."
                };
        }
    }
}
