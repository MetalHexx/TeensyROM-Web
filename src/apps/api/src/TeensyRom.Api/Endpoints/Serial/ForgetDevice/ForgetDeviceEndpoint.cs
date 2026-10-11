using RadEndpoints;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Api.Endpoints.ForgetDevice
{
    public class ForgetDeviceEndpoint(IDeviceConnectionManager deviceManager) : RadEndpoint<ForgetDeviceRequest, ForgetDeviceResponse>
    {
        public override void Configure()
        {
            Delete("/api/devices/{deviceId}")
                .Produces<ForgetDeviceResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict)
                .WithName("ForgetDevice")
                .WithSummary("Forget Device")
                .WithTags("Devices")
                .WithDescription(
                    "Removes a known, offline TeensyROM device from memory and the saved connection file.\n\n" +
                    "- Only an offline device can be forgotten; an available device is left untouched."
                );
        }

        public override async Task Handle(ForgetDeviceRequest r, CancellationToken ct)
        {
            var result = await deviceManager.ForgetAsync(r.DeviceId, ct);

            switch (result)
            {
                case ForgetResult.Forgotten:
                    Response = new();
                    Send();
                    return;

                case ForgetResult.StillAvailable:
                    SendProblem(TypedResults.Problem(
                        title: "Device is still available.",
                        statusCode: StatusCodes.Status409Conflict,
                        detail: "Only an offline device can be forgotten."
                    ));
                    return;

                case ForgetResult.UnknownDevice:
                default:
                    SendNotFound($"The device {r.DeviceId} was not found.");
                    return;
            }
        }
    }
}
