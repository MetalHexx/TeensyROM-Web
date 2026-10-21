using MediatR;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Serial.Commands.Behaviors
{
    /// <summary>
    /// Turns an exception thrown inside a command into a failed result and writes it to the log service,
    /// tagged with the request's device id when the request carries one.
    /// </summary>
    public class ExceptionBehavior<TRequest, TResponse>(ILoggingService log) : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
    where TResponse : TeensyCommandResult, new()
    {
        public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
        {
            TResponse response;
            try
            {
                response = await next();
            }
            catch (TeensyDjException)
            {
                throw;
            }
            catch (TeensyBusyException ex)
            {
                log.InternalWarning(ex.Message, GetDeviceId(request));
                return new TResponse
                {
                    IsSuccess = false,
                    IsBusy = true,
                    Error = ex.Message
                };
            }
            catch (TeensyLinkException ex)
            {
                log.InternalError(ex.Message, GetDeviceId(request));
                return new TResponse
                {
                    IsSuccess = false,
                    Error = ex.Message
                };
            }
            catch (Exception ex)
            {
                var message = GetExceptionMessage(ex);
                log.InternalError($"{message}{Environment.NewLine}{ex}", GetDeviceId(request));

                return new TResponse
                {
                    IsSuccess = false,
                    Error = message
                };
            }
            return response;
        }

        private static string? GetDeviceId(TRequest request) => (request as ITeensyCommand<TResponse>)?.DeviceId;

        public string GetExceptionMessage(Exception ex) =>
            ex switch
            {
                TimeoutException => "The TeensyROM did not answer in time.",
                _ when ex.Message.All(c => c == '\0' || char.IsWhiteSpace(c)) => "Error communicating with TeensyROM.",
                _ when ex.Message.Contains("port is closed", StringComparison.OrdinalIgnoreCase) => "Disconnected from TeensyROM",
                _ when ex.Message.Contains("Cannot perform serial operations in", StringComparison.OrdinalIgnoreCase) => "Error communicating with TeensyROM.",
                _ => $"Unexpected Error: {ex.Message}"
            };
    }
}