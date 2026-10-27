using TeensyRom.Api.Http;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Api.Endpoints.FindCarts
{
    public class FindDevicesEndpoint(
        IDeviceConnectionManager deviceManager,
        IDeviceTransferLease lease,
        IDeviceSettingsProvider deviceSettingsProvider) : RadEndpoint<FindDevicesRequest, FindDevicesResponse>
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
                    "Returns all available and connected TeensyROM devices, followed by every known offline unit.\n\n" +
                    "- By default (fullScan=false), returns the devices already listed by the manager - no device is contacted.\n" +
                    "- Set fullScan=true to run a full discovery sweep: every COM port and the local subnet are scanned, " +
                    "and every currently connected device is momentarily disconnected while the sweep runs.\n" +
                    "- Only full scans are rate limited, to one per 5 seconds; a request over the limit is answered 503. A plain listing is never limited.\n" +
                    "- Offline units are listed after the online ones, with deviceState ConnectionLost.\n" +
                    "- A device busy with a transfer shows its job in activeTransferJobId; a full scan skips it."
                );
        }

        public override async Task Handle(FindDevicesRequest request, CancellationToken ct)
        {
            var devices = await deviceManager.FindDevices(autoConnect: false, ct, fullScan: request.FullScan);
            var offlineDevices = deviceManager.GetOfflineDevices();

            if (devices.Count == 0 && offlineDevices.Count == 0)
            {
                SendNotFound("No TeensyRom devices found.");
                return;
            }

            List<CartDto> deviceDtos = [.. await Task.WhenAll(devices.Select(d => CartDto.FromDevice(d, deviceSettingsProvider)))];
            deviceDtos.AddRange(offlineDevices.Select(d => CartDto.FromOffline(d, deviceSettingsProvider)));

            foreach (var dto in deviceDtos)
            {
                dto.ActiveTransferJobId = lease.GetActiveJobId(dto.DeviceId);
            }

            Response = new()
            {
                Devices = deviceDtos,
                Message = "Success!"
            };
            Send();
        }
    }
}
