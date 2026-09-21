using MediatR;
using TeensyRom.Core.Common;
using TeensyRom.Core.Serial.Routines;

namespace TeensyRom.Core.Commands.PlaySubtune
{

    public class PlaySubtuneHandler() : IRequestHandler<PlaySubtuneCommand, PlaySubtuneResult>
    {
        public Task<PlaySubtuneResult> Handle(PlaySubtuneCommand request, CancellationToken cancellationToken)
        {
            try
            {
                request.CommunicationPort.PlaySubtune((uint)request.SubtuneIndex);
            }
            catch (TeensyException ex)
            {
                return Task.FromResult(new PlaySubtuneResult
                {
                    IsSuccess = false,
                    Error = ex.Message
                });
            }
            return Task.FromResult(new PlaySubtuneResult
            {
                IsSuccess = true
            });
        }
    }
}
