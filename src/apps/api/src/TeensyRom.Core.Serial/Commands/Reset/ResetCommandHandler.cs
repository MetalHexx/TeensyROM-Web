using MediatR;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Commands
{
    public class ResetCommandHandler(IAlertService alert) : IRequestHandler<ResetCommand, ResetResult>
    {        
        public async Task<ResetResult> Handle(ResetCommand request, CancellationToken cancellationToken)
        {
            var resetRoutine = new ResetSerialRoutine(request.Serial, alert);
            var resetResult = await resetRoutine.Execute();

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
