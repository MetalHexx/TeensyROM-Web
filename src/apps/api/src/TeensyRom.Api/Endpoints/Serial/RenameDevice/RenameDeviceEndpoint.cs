using RadEndpoints;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Api.Endpoints.RenameDevice
{
    public class RenameDeviceEndpoint(
        IDeviceConnectionManager deviceManager,
        IDeviceSettingsProvider deviceSettingsProvider) : RadEndpoint<RenameDeviceRequest, RenameDeviceResponse>
    {
        public override void Configure()
        {
            Put("/api/devices/{deviceId}/name")
                .Produces<RenameDeviceResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .WithName("RenameDevice")
                .WithSummary("Rename Device")
                .WithTags("Devices")
                .WithDescription(
                    "Sets the saved name of a known TeensyROM device.\n\n" +
                    "- Works whether the device is available or offline; no device is contacted.\n" +
                    "- Not queued behind a running discovery: the rename is applied and saved immediately."
                );
        }

        public override async Task Handle(RenameDeviceRequest r, CancellationToken ct)
        {
            var outcome = await deviceManager.RenameAsync(r.DeviceId, r.Body.Name, ct);

            switch (outcome.Result)
            {
                case RenameResult.Renamed:
                    Response = new()
                    {
                        Device = outcome.Device is not null
                            ? await CartDto.FromDevice(outcome.Device, deviceSettingsProvider)
                            : CartDto.FromOffline(outcome.OfflineDevice!, deviceSettingsProvider)
                    };
                    Send();
                    return;

                case RenameResult.InvalidName:
                    SendValidationError("Name must be 1–24 characters with no control characters.");
                    return;

                case RenameResult.UnknownDevice:
                default:
                    SendNotFound($"The device {r.DeviceId} was not found.");
                    return;
            }
        }
    }
}
