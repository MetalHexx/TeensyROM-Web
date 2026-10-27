using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using RadEndpoints;
using TeensyRom.Api.Endpoints.Common;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Device;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Endpoints.Files.IndexAll
{
    public class IndexAllEndpoint(IDeviceConnectionManager deviceManager, IDeviceTransferLease lease, IDeviceSettingsProvider settingsProvider) : RadEndpointWithoutRequest<IndexAllResponse>
    {
        private readonly IDeviceSettingsProvider _settingsProvider = settingsProvider;
        
        public override void Configure()
        {
            Post("/api/files/index/all")
                .Produces<IndexAllResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("IndexAll")
                .WithSummary("Index All")
                .WithTags("Files")
                .WithDescription(
                    "Indexes all storage for all connected TeensyROM devices.\n\n" +
                    "- This will recursively index all storage devices.\n" +
                    "- Multiple devices will be indexed in parallel, one device type at a time.\n" +
                    "- This could take a few minutes if you have a lot of data.\n" +
                    "- Don't touch your commodores while indexing is in progress.\n" +
                    "- A device busy with a transfer is skipped and the other devices are still indexed; " +
                    "its id is listed in busyDeviceIds.\n" +
                    "- Answers 409 (code deviceBusyWithTransfer) when the device is busy with a transfer."
                );
        }

        public override async Task Handle(CancellationToken ct)
        {
            var available = deviceManager.GetAvailableDevices();

            if (available.Count == 0)
            {
                SendNotFound("No devices found.");
                return;
            }

            // Indexing clears a device's cache before it reads, so a transferring device is skipped before CacheAll.
            var busy = available
                .Select(d => (Device: d, JobId: lease.GetActiveJobId(d.DeviceId)))
                .Where(x => x.JobId is not null)
                .ToList();
            var devices = available.Where(d => busy.All(b => b.Device.DeviceId != d.DeviceId)).ToList();

            var sdTasks = devices
                .Where(d => d.Cart.SdStorage.Available)
                .Select(d => new
                {
                    DeviceId = d.DeviceId,
                    StorageType = "SD",
                    Task = d.SdStorage.CacheAll(ct)
                })
                .ToList();

            await Task.WhenAll(sdTasks.Select(t => t.Task));
            foreach (var task in sdTasks.Where(t => t.Task.Result))
            {
                var deviceSettings = _settingsProvider.GetOrCreateDeviceSettings(task.DeviceId);
                deviceSettings = deviceSettings with
                {
                    IndexingStatus = deviceSettings.IndexingStatus with
                    {
                        SdLastIndexed = DateTime.UtcNow
                    }
                };
                _settingsProvider.SaveDeviceSettings(deviceSettings);
            }

            var usbTasks = devices
                .Where(d => d.Cart.UsbStorage.Available)
                .Select(d => new
                {
                    d.DeviceId,
                    StorageType = "USB",
                    Task = d.UsbStorage.CacheAll(ct)
                })
                .ToList();

            await Task.WhenAll(usbTasks.Select(t => t.Task));
            foreach (var task in usbTasks.Where(t => t.Task.Result))
            {
                var deviceSettings = _settingsProvider.GetOrCreateDeviceSettings(task.DeviceId);
                deviceSettings = deviceSettings with
                {
                    IndexingStatus = deviceSettings.IndexingStatus with
                    {
                        UsbLastIndexed = DateTime.UtcNow
                    }
                };
                _settingsProvider.SaveDeviceSettings(deviceSettings);
            }

            var busyDeviceIds = busy.Select(b => b.Device.DeviceId).ToArray();

            var failedItems = sdTasks
                .Where(t => !t.Task.Result)
                .Concat(usbTasks.Where(t => !t.Task.Result))
                .Select(t => new
                {
                    t.DeviceId,
                    t.StorageType
                })
                .ToList();

            if (failedItems.Count > 0)
            {
                var extensions = failedItems
                    .GroupBy(f => f.DeviceId!)
                    .ToDictionary(
                        g => g.Key,
                        g => (object)g.Select(x => x.StorageType).ToList()
                    );

                if (busyDeviceIds.Length > 0)
                {
                    extensions["busyDeviceIds"] = busyDeviceIds;
                }

                SendProblem(TypedResults.Problem(
                    title: "Indexing failure.",
                    statusCode: StatusCodes.Status500InternalServerError,
                    detail: "Some storage devices had issues indexing.  See error list.",
                    extensions: extensions!
                ));
                return;
            }

            if (busy.Count > 0)
            {
                var first = busy[0];
                var problem = DeviceBusyProblem.Create(
                    first.Device.DeviceId,
                    first.Device.Cart.Name,
                    first.JobId!,
                    detail: devices.Count > 0 ? "The other devices were indexed." : null);
                problem.ProblemDetails.Extensions["busyDeviceIds"] = busyDeviceIds;
                SendProblem(problem);
                return;
            }

            Response = new();
            Send();
        }
    }
}
