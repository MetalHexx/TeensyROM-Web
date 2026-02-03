using System.Runtime.CompilerServices;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Endpoints.Files.Index
{
    public class IndexEndpoint(IDeviceConnectionManager deviceManager, IDeviceSettingsProvider settingsProvider) : RadEndpoint<IndexRequest, IndexResponse>
    {
        private readonly IDeviceSettingsProvider _settingsProvider = settingsProvider;
        public override void Configure()
        {
            Post("/api/devices/{deviceId}/storage/{storageType}/index")
                .Produces<IndexResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status400BadRequest)
                .WithName("Index")
                .WithSummary("Index")
                .WithTags("Files")
                .WithDescription(
                    "Indexes the directory structure of a given TeensyROM device and storage type.\n\n" +
                    "- Providing a path will index starting at that directory and all subdirectories below it.\n" +
                    "- Providing no path will index the whole storage device.\n" +
                    "- Don't touch your commodore while indexing is in progress."
                );
        }

        public override async Task Handle(IndexRequest r, CancellationToken ct)
		{
			var device = deviceManager.GetAvailableDevice(r.DeviceId);

			if (device is null)
			{
				SendNotFound("Device not found.");
				return;
			}

			// Determine if this is a full index operation
			var isFullIndex = string.IsNullOrWhiteSpace(r.StartingPath) || r.StartingPath == StorageHelper.Remote_Path_Root;

			var result = r.StorageType is TeensyStorageType.SD
				? await HandleCaching(r, device.SdStorage, isFullIndex, ct)
				: await HandleCaching(r, device.UsbStorage, isFullIndex, ct);

			if (!result)
			{
				SendInternalError("There was an error indexing.");
				return;
			}
			if (isFullIndex)
			{
				SaveIndexStatus(r);
			}
			Response = new();
			Send();
		}

		/// <summary>
		/// Updates the last indexed timestamp for full index operations.
		/// </summary>
		private void SaveIndexStatus(IndexRequest r)
		{				
			var deviceSettings = _settingsProvider.GetOrCreateDeviceSettings(r.DeviceId);

			if (r.StorageType == TeensyStorageType.SD)
			{
				deviceSettings = deviceSettings with
				{
					IndexingStatus = deviceSettings.IndexingStatus with
					{
						SdLastIndexed = DateTime.UtcNow
					}
				};
			}
			else // USB
			{
				deviceSettings = deviceSettings with
				{
					IndexingStatus = deviceSettings.IndexingStatus with
					{
						UsbLastIndexed = DateTime.UtcNow
					}
				};
			}
			
			_settingsProvider.SaveDeviceSettings(deviceSettings);
		}

		private async Task<bool> HandleCaching(IndexRequest r, IStorageService s, bool isFullIndex, CancellationToken ct) 
        {
            if (!string.IsNullOrWhiteSpace(r.StartingPath))
            {
                return await s.Cache(new DirectoryPath(r.StartingPath), ct);
            }
            
            return await s.CacheAll(ct);
        }
    }
}
