using MediatR;
using System.Reactive.Linq;
using System.Reactive.Threading.Tasks;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Serial.State;

namespace TeensyRom.Core.Serial.Commands.Behaviors
{
    /// <summary>
    /// Disables the serial read auto-poll behavior for the duration of the command and reneables it after.
    /// </summary>
    public class SerialBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
        where TRequest : ITeensyCommand<TResponse>
        where TResponse : TeensyCommandResult, new()
    {
        public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
        {
            TResponse response = default!;

            var serial = request.Serial;
            
            await serial.CurrentState
                .Where(state => state is not SerialBusyState)
                .FirstAsync()
                .ToTask(cancellationToken);

            try
            {
                serial.Lock();
                serial.StopHealthCheck();
                serial.TransitionTo(typeof(SerialBusyState));
                response = await next();
            }
            finally
            {
                serial.Unlock();
                serial.StartHealthCheck();
            }
            return response;
        }
    }
}