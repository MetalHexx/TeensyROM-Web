using MediatR;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Serial.Commands.SetColor
{
    /// <summary>Sets one menu color. A device refusal propagates to the pipeline, which turns it into a failed result.</summary>
    public class SetColorHandler : IRequestHandler<SetColorCommand, SetColorResult>
    {
        public Task<SetColorResult> Handle(SetColorCommand request, CancellationToken cancellationToken)
        {
            request.CommunicationPort.SetColor(request.Slot, (uint)request.Color);
            return Task.FromResult(new SetColorResult());
        }
    }
}
