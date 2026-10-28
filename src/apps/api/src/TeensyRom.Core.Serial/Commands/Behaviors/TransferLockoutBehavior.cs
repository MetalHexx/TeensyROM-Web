using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Serial.Commands.Behaviors
{
    /// <summary>
    /// Refuses, at once, any command for a device whose transfer lease is held by another job. Only a
    /// <see cref="ITransferCommand"/> stamped with the holder's own job id passes, so the transfer's reset
    /// and file batches go through while everything else - an endpoint's reset, a launch, a directory
    /// read - gets a failed result naming the job in <see cref="TeensyCommandResult.ActiveTransferJobId"/>.
    /// <remarks>
    /// Never waits and never throws, and keeps no lock of its own: it sits ahead of
    /// <see cref="CommunicationPortBehavior{TRequest, TResponse}"/> so a refused command never queues on
    /// the device's port lock behind the transfer.
    /// </remarks>
    /// </summary>
    public class TransferLockoutBehavior<TRequest, TResponse>(IDeviceTransferLease lease, IDeviceConnectionManager devices, ILoggingService log) : IPipelineBehavior<TRequest, TResponse>
        where TRequest : ITeensyCommand<TResponse>
        where TResponse : TeensyCommandResult, new()
    {
        public Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
        {
            var deviceId = request.DeviceId;

            if (deviceId is null)
            {
                return next();
            }

            var holder = lease.GetActiveJobId(deviceId);

            if (holder is null || request is ITransferCommand { TransferJobId: var jobId } && jobId == holder)
            {
                return next();
            }

            var name = devices.GetAvailableDevice(deviceId)?.Cart.Name ?? deviceId;

            log.InternalWarning($"{typeof(TRequest).Name} refused: the device is busy with transfer {holder}.", deviceId);

            return Task.FromResult(new TResponse
            {
                IsSuccess = false,
                Error = $"{name} is busy with a transfer.",
                ActiveTransferJobId = holder
            });
        }
    }
}
