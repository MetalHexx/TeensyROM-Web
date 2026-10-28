using MediatR;
using TeensyRom.Api.Endpoints.Common;
using TeensyRom.Api.Endpoints.ResetDevice;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;

namespace TeensyRom.Api.Endpoints.Serial.PingDevice
{
    public class PingDeviceEndpoint(IDeviceConnectionManager deviceManager, IMediator mediator) : RadEndpoint<PingDeviceRequest, PingDeviceResponse>
    {
        public override void Configure()
        {
            Get("/api/devices/{deviceId}/ping")
                .Produces<PingDeviceResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict)
                .ProducesProblem(StatusCodes.Status502BadGateway)
                .WithName("PingDevice")
                .WithSummary("Ping Device")
                .WithTags("Devices")
                .WithDescription(
                    "Pings a TeensyROM device to check if it is responsive.\n\n" +
                    "- Works the same as clicking the cartridge reset button.\n" +
                    "- Answers 409 (code deviceBusyWithTransfer) when the device is busy with a transfer."
                );
        }
        public override async Task Handle(PingDeviceRequest r, CancellationToken ct)
        {
            var device = deviceManager.GetAvailableDevice(r.DeviceId);
            
            if (device is null)
            {
                SendNotFound($"The device {r.DeviceId} was not found.");
                return;
            }
            var result = await mediator.Send(new PingCommand
            {
                DeviceId = device.Cart.DeviceId,
                CommunicationPort = device.CommunicationPort
            });

            if (!result.IsSuccess)
            {
                if (result.ActiveTransferJobId is { } jobId)
                {
                    SendProblem(DeviceBusyProblem.Create(r.DeviceId, device.Cart.Name, jobId));
                    return;
                }
                SendExternalError(string.IsNullOrWhiteSpace(result.Error?.Trim('\0')) ? "The TeensyROM did not answer the ping." : result.Error);
                return;
            }

            Response = new();
            Send();
        }
    }
}