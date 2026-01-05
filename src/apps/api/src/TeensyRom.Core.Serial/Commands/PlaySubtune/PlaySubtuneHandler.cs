using MediatR;
using TeensyRom.Core.Common;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Commands.PlaySubtune
{

    public class PlaySubtuneHandler() : IRequestHandler<PlaySubtuneCommand, PlaySubtuneResult>
    {
        public async Task<PlaySubtuneResult> Handle(PlaySubtuneCommand request, CancellationToken cancellationToken)
        {
            try
            {
                request.CommunicationPort.PlaySubtune((uint)request.SubtuneIndex);
            }
            catch (TeensyException ex)
            {
                return new PlaySubtuneResult
                {
                    IsSuccess = false,
                    Error = ex.Message
                };
            }
            return new PlaySubtuneResult
            {
                IsSuccess = true
            };
        }
    }
}
