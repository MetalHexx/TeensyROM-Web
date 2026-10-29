using MediatR;
using RadEndpoints;
using TeensyRom.Api.Endpoints.Common;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Serial.Commands.LaunchAsidPlayer;

namespace TeensyRom.Api.Endpoints.LaunchAsidPlayer
{
    public class LaunchAsidPlayerEndpoint(IDeviceConnectionManager deviceManager, IMediator mediator) : RadEndpoint<LaunchAsidPlayerRequest, LaunchAsidPlayerResponse>
    {
        public override void Configure()
        {
            Post("/api/devices/{deviceId}/asid-player/launch")
                .Produces<LaunchAsidPlayerResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict)
                .ProducesProblem(StatusCodes.Status502BadGateway)
                .WithName("LaunchAsidPlayer")
                .WithSummary("Launch ASID Player")
                .WithTags("Devices")
                .WithDescription(
                    "Starts the cartridge's built-in ASID player.\n\n" +
                    "- A device on the network is moved onto its USB serial port first, because the player turns the network off; it stays on serial until the next reconnect.\n" +
                    "- Answers 502 (code usbUnreachable) when a network device cannot be reached over USB; nothing is launched then.\n" +                    "- Answers 409 (code deviceBusyWithTransfer) when the device is busy with a transfer."
                );
        }

        public override async Task Handle(LaunchAsidPlayerRequest r, CancellationToken ct)
        {
            var device = deviceManager.GetAvailableDevice(r.DeviceId);

            if (device is null)
            {
                SendNotFound($"The device {r.DeviceId} was not found.");
                return;
            }

            var result = await mediator.Send(new LaunchAsidPlayerCommand
            {
                DeviceId = device.Cart.DeviceId,
                CommunicationPort = device.CommunicationPort
            }, ct);

            if (result.ActiveTransferJobId is { } jobId)
            {
                SendProblem(DeviceBusyProblem.Create(r.DeviceId, device.Cart.Name, jobId));
                return;
            }

            if (result.UsbUnreachable)
            {
                SendProblem(UsbUnreachableProblem.Create(r.DeviceId, device.Cart.Name));
                return;
            }

            if (!result.IsSuccess)
            {
                if (result.MovedToSerial)
                {
                    SendProblem(TypedResults.Problem(
                        title: result.Error,
                        statusCode: StatusCodes.Status502BadGateway,
                        extensions: new Dictionary<string, object?> { ["movedToSerial"] = true }));
                    return;
                }

                SendExternalError(result.Error);
                return;
            }

            Response = new() { MovedToSerial = result.MovedToSerial };
            Send();
        }
    }
}
