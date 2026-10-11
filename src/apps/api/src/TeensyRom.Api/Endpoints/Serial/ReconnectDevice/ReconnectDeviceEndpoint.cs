using RadEndpoints;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Api.Endpoints.ReconnectDevice
{
    public class ReconnectDeviceEndpoint(
        IDeviceConnectionManager deviceManager,
        IDeviceSettingsProvider deviceSettingsProvider) : RadEndpoint<ReconnectDeviceRequest, ReconnectDeviceResponse>
    {
        public override void Configure()
        {
            Post("/api/devices/{deviceId}/reconnect")
                .Produces<ReconnectDeviceResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status502BadGateway)
                .WithName("ReconnectDevice")
                .WithSummary("Reconnect Device")
                .WithTags("Devices")
                .WithDescription(
                    "Reconnects a known but currently offline TeensyROM device.\n\n" +
                    "- Tries the unit's saved addresses, preferred transport first; a miss runs one search for missing units.\n" +
                    "- An already available device returns immediately with no device contact.\n" +
                    "- Not rate limited: the manager runs reconnects one at a time on its own."
                );
        }

        public override async Task Handle(ReconnectDeviceRequest r, CancellationToken ct)
        {
            var outcome = await deviceManager.ReconnectAsync(r.DeviceId, ct);

            switch (outcome.Result)
            {
                case ReconnectResult.Reconnected:
                case ReconnectResult.AlreadyAvailable:
                    Response = new()
                    {
                        Device = await CartDto.FromDevice(outcome.Device!, deviceSettingsProvider)
                    };
                    Send();
                    return;

                case ReconnectResult.NotFound:
                    SendExternalError($"The device {r.DeviceId} could not be found at its saved addresses or by a search.");
                    return;

                case ReconnectResult.UnknownDevice:
                default:
                    SendNotFound($"The device {r.DeviceId} was not found.");
                    return;
            }
        }
    }
}
