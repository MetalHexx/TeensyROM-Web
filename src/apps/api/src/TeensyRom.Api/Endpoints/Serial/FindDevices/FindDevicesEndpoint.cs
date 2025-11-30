using TeensyRom.Api.Http;
using TeensyRom.Api.Models;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Endpoints.FindCarts
{
    public class FindDevicesEndpoint(
        IDeviceConnectionManager deviceManager,
        IDeviceSettingsProvider deviceSettingsProvider) : RadEndpointWithoutRequest<FindDevicesResponse>
    {
        public override void Configure()
        {
            Get("/api/devices/")
                .Produces<FindDevicesResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status503ServiceUnavailable)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .RequireRateLimiting(RateLimitHelper.FindDevicesRateLimiter)
                .WithName("FindDevices")
                .WithSummary("Find Devices")
                .WithTags("Devices")
                .WithDescription(
                    "Returns all available and connected TeensyROM devices.\n\n" +
                    "- This will momentarily disconnect all devices.\n" +
                    "- All available COM ports will be scanned for TeensyROM devices.\n" +
                    "- Devices with auto-connect enabled will reconnect automatically."
                );
        }

        public override async Task Handle(CancellationToken ct)
        {
            var devices = await deviceManager.FindDevices(autoConnect: false, ct);

            if (devices.Count == 0)
            {
                SendNotFound("No TeensyRom devices found.");
                return;
            }
            foreach (var device in devices)
            {
                var deviceSettings = deviceSettingsProvider.GetOrCreateDeviceSettings(device.DeviceId);
                
                if (deviceSettings.ConnectionSettings.AutoConnectEnabled)
                {
                    deviceManager.Connect(device.DeviceId);
                }
            }

            List<CartDto> deviceDtos = [.. await Task.WhenAll(devices.Select(CartDto.FromDevice))];

            Response = new()
            {
                Devices = deviceDtos,
                Message = "Success!"
            };
            Send();
        }
    }
}
