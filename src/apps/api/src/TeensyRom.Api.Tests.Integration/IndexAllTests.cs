using TeensyRom.Api.Endpoints.Files.Index;
using TeensyRom.Api.Endpoints.Files.IndexAll;
using TeensyRom.Api.Endpoints.FindCarts;
using TeensyRom.Api.Endpoints.Settings.GetSettings;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Tests.Integration
{
    [Collection("Endpoint")]
    public class IndexAllTests(EndpointFixture f)
    {
        [Fact]
        public async Task When_IndexingAll_SuccessReturned()
        {
			// Arrange - TrClient automatically handles enum serialization
			var deviceResult = await f.Client.GetAsync<FindDevicesEndpoint, FindDevicesRequest, FindDevicesResponse>(new FindDevicesRequest
			{
				FullScan = false
			});

            foreach (var item in deviceResult.Content.Devices)
            {
                f.DeleteCache(item.DeviceId!, TeensyStorageType.SD);
                f.DeleteCache(item.DeviceId!, TeensyStorageType.USB);
            }

            // Act - TrClient automatically handles enum serialization for endpoints without request
            var response = await f.Client.PostAsync<IndexAllEndpoint, IndexResponse>();

            // Assert
            response.Should().BeSuccessful<IndexResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            var availableSdDevices = deviceResult.Content.Devices
                .Where(d => d.SdStorage.Available)
                .ToList();

            if (availableSdDevices.Count > 0) 
            {
                availableSdDevices
                .Should()
                .AllSatisfy(item =>
                {
                    f.CacheExists(item.DeviceId!, TeensyStorageType.SD).Should().BeTrue();
                });
            }

            var availableUsbDevices = deviceResult.Content.Devices
                    .Where(d => d.UsbStorage.Available)
                    .ToList();

            if (availableUsbDevices.Count > 0)
            {
                availableUsbDevices
                    .Should()
                    .AllSatisfy(item =>
                    {
                        f.CacheExists(item.DeviceId!, TeensyStorageType.USB).Should().BeTrue();
                    });
                response.Content.Message.Should().Contain("Success");
            }
        }

        [Fact]
        public async Task IndexAll_SuccessfulSdIndexing_SavesTimestampsToDeviceSettings()
        {
            // Arrange
            var deviceResult = await f.Client.GetAsync<FindDevicesEndpoint, FindDevicesRequest, FindDevicesResponse>(new FindDevicesRequest
            {
                FullScan = false
            });

            var sdDevices = deviceResult.Content.Devices
                .Where(d => d.SdStorage.Available)
                .ToList();

            if (sdDevices.Count == 0)
            {
                // Skip test if no SD devices available
                return;
            }

            // Clear cache to force full indexing
            foreach (var device in sdDevices)
            {
                f.DeleteCache(device.DeviceId!, TeensyStorageType.SD);
            }

            // Get initial settings
            var initialSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();

            // Act
            var beforeIndex = DateTime.UtcNow.AddSeconds(-1);
            var response = await f.Client.PostAsync<IndexAllEndpoint, IndexResponse>();
            var afterIndex = DateTime.UtcNow.AddSeconds(1);

            // Assert - Verify successful indexing
            response.Should().BeSuccessful<IndexResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            // Verify timestamps were saved for SD devices
            var updatedSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();

            foreach (var device in sdDevices)
            {
                var updatedDevice = updatedSettings.Content.KnownDevices
                    .FirstOrDefault(d => d.DeviceId == device.DeviceId);

                updatedDevice.Should().NotBeNull();
                updatedDevice!.IndexingStatus.Should().NotBeNull();
                updatedDevice.IndexingStatus.SdLastIndexed.Should().NotBeNull(
                    "successful SD indexing should save timestamp");
                updatedDevice.IndexingStatus.SdLastIndexed.Should().BeAfter(beforeIndex);
                updatedDevice.IndexingStatus.SdLastIndexed.Should().BeBefore(afterIndex);
            }
        }

        [Fact]
        public async Task IndexAll_SuccessfulUsbIndexing_SavesTimestampsToDeviceSettings()
        {
            // Arrange
            var deviceResult = await f.Client.GetAsync<FindDevicesEndpoint, FindDevicesRequest, FindDevicesResponse>(new FindDevicesRequest
            {
                FullScan = false
            });

            var usbDevices = deviceResult.Content.Devices
                .Where(d => d.UsbStorage.Available)
                .ToList();

            if (usbDevices.Count == 0)
            {
                // Skip test if no USB devices available
                return;
            }

            // Clear cache to force full indexing
            foreach (var device in usbDevices)
            {
                f.DeleteCache(device.DeviceId!, TeensyStorageType.USB);
            }

            // Act
            var beforeIndex = DateTime.UtcNow.AddSeconds(-1);
            var response = await f.Client.PostAsync<IndexAllEndpoint, IndexResponse>();
            var afterIndex = DateTime.UtcNow.AddSeconds(1);

            // Assert - Verify successful indexing
            response.Should().BeSuccessful<IndexResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            // Verify timestamps were saved for USB devices
            var updatedSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();

            foreach (var device in usbDevices)
            {
                var updatedDevice = updatedSettings.Content.KnownDevices
                    .FirstOrDefault(d => d.DeviceId == device.DeviceId);

                updatedDevice.Should().NotBeNull();
                updatedDevice!.IndexingStatus.Should().NotBeNull();
                updatedDevice.IndexingStatus.UsbLastIndexed.Should().NotBeNull(
                    "successful USB indexing should save timestamp");
                updatedDevice.IndexingStatus.UsbLastIndexed.Should().BeAfter(beforeIndex);
                updatedDevice.IndexingStatus.UsbLastIndexed.Should().BeBefore(afterIndex);
            }
        }

        [Fact]
        public async Task IndexAll_BothStorageTypes_SavesIndependentTimestamps()
        {
            // Arrange
            var deviceResult = await f.Client.GetAsync<FindDevicesEndpoint, FindDevicesRequest, FindDevicesResponse>(new FindDevicesRequest
            {
                FullScan = false
            });

            var devicesWithBoth = deviceResult.Content.Devices
                .Where(d => d.SdStorage.Available && d.UsbStorage.Available)
                .ToList();

            if (devicesWithBoth.Count == 0)
            {
                // Skip test if no devices with both storage types
                return;
            }

            // Clear cache to force full indexing
            foreach (var device in devicesWithBoth)
            {
                f.DeleteCache(device.DeviceId!, TeensyStorageType.SD);
                f.DeleteCache(device.DeviceId!, TeensyStorageType.USB);
            }

            // Act
            var beforeIndex = DateTime.UtcNow.AddSeconds(-1);
            var response = await f.Client.PostAsync<IndexAllEndpoint, IndexResponse>();
            var afterIndex = DateTime.UtcNow.AddSeconds(1);

            // Assert - Verify successful indexing
            response.Should().BeSuccessful<IndexResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            // Verify both timestamps were saved independently
            var updatedSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();

            foreach (var device in devicesWithBoth)
            {
                var updatedDevice = updatedSettings.Content.KnownDevices
                    .FirstOrDefault(d => d.DeviceId == device.DeviceId);

                updatedDevice.Should().NotBeNull();
                updatedDevice!.IndexingStatus.Should().NotBeNull();
                
                // Verify both timestamps exist
                updatedDevice.IndexingStatus.SdLastIndexed.Should().NotBeNull(
                    "SD storage should have timestamp");
                updatedDevice.IndexingStatus.UsbLastIndexed.Should().NotBeNull(
                    "USB storage should have timestamp");
                
                // Verify both are recent
                updatedDevice.IndexingStatus.SdLastIndexed.Should().BeAfter(beforeIndex);
                updatedDevice.IndexingStatus.SdLastIndexed.Should().BeBefore(afterIndex);
                updatedDevice.IndexingStatus.UsbLastIndexed.Should().BeAfter(beforeIndex);
                updatedDevice.IndexingStatus.UsbLastIndexed.Should().BeBefore(afterIndex);
            }
        }

        [Fact]
        public async Task IndexAll_MultipleDevices_GetIndependentTimestamps()
        {
            // Arrange
            var deviceResult = await f.Client.GetAsync<FindDevicesEndpoint, FindDevicesRequest, FindDevicesResponse>(new FindDevicesRequest
            {
                FullScan = false
            });

            var devices = deviceResult.Content.Devices.ToList();

            if (devices.Count < 2)
            {
                // Skip test if less than 2 devices available
                return;
            }

            // Clear cache to force full indexing
            foreach (var device in devices)
            {
                if (device.SdStorage.Available)
                    f.DeleteCache(device.DeviceId!, TeensyStorageType.SD);
                if (device.UsbStorage.Available)
                    f.DeleteCache(device.DeviceId!, TeensyStorageType.USB);
            }

            // Act
            var beforeIndex = DateTime.UtcNow.AddSeconds(-1);
            var response = await f.Client.PostAsync<IndexAllEndpoint, IndexResponse>();
            var afterIndex = DateTime.UtcNow.AddSeconds(1);

            // Assert - Verify successful indexing
            response.Should().BeSuccessful<IndexResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            // Verify each device got independent timestamps
            var updatedSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();

            foreach (var device in devices)
            {
                var updatedDevice = updatedSettings.Content.KnownDevices
                    .FirstOrDefault(d => d.DeviceId == device.DeviceId);

                updatedDevice.Should().NotBeNull();
                updatedDevice!.IndexingStatus.Should().NotBeNull();

                // Verify timestamps based on available storage
                if (device.SdStorage.Available)
                {
                    updatedDevice.IndexingStatus.SdLastIndexed.Should().NotBeNull(
                        $"device {device.DeviceId} should have SD timestamp");
                    updatedDevice.IndexingStatus.SdLastIndexed.Should().BeAfter(beforeIndex);
                    updatedDevice.IndexingStatus.SdLastIndexed.Should().BeBefore(afterIndex);
                }

                if (device.UsbStorage.Available)
                {
                    updatedDevice.IndexingStatus.UsbLastIndexed.Should().NotBeNull(
                        $"device {device.DeviceId} should have USB timestamp");
                    updatedDevice.IndexingStatus.UsbLastIndexed.Should().BeAfter(beforeIndex);
                    updatedDevice.IndexingStatus.UsbLastIndexed.Should().BeBefore(afterIndex);
                }
            }

            // Verify at least 2 devices were processed (based on test requirement)
            var devicesWithTimestamps = updatedSettings.Content.KnownDevices
                .Count(d => d.IndexingStatus.SdLastIndexed.HasValue || d.IndexingStatus.UsbLastIndexed.HasValue);

            devicesWithTimestamps.Should().BeGreaterOrEqualTo(2,
                "multiple devices should receive independent timestamps");
        }

        [Fact]
        public async Task IndexAll_SequentialCalls_UpdatesTimestampsToLatest()
        {
            // Arrange
            var deviceResult = await f.Client.GetAsync<FindDevicesEndpoint, FindDevicesRequest, FindDevicesResponse>(new FindDevicesRequest
            {
                FullScan = false
            });

            var sdDevices = deviceResult.Content.Devices
                .Where(d => d.SdStorage.Available)
                .ToList();

            if (sdDevices.Count == 0)
            {
                // Skip test if no SD devices available
                return;
            }

            // Clear cache and run first index
            foreach (var device in sdDevices)
            {
                f.DeleteCache(device.DeviceId!, TeensyStorageType.SD);
            }

            // Act - First indexing
            await f.Client.PostAsync<IndexAllEndpoint, IndexResponse>();

            // Get first timestamps
            var firstSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();
            var firstTimestamps = sdDevices.ToDictionary(
                d => d.DeviceId!,
                d => firstSettings.Content.KnownDevices
                    .First(kd => kd.DeviceId == d.DeviceId)
                    .IndexingStatus.SdLastIndexed
            );

            // Wait to ensure timestamps differ
            await Task.Delay(1100);

            // Act - Second indexing
            var beforeSecondIndex = DateTime.UtcNow.AddSeconds(-1);
            await f.Client.PostAsync<IndexAllEndpoint, IndexResponse>();
            var afterSecondIndex = DateTime.UtcNow.AddSeconds(1);

            // Assert - Verify timestamps were updated
            var secondSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();

            foreach (var device in sdDevices)
            {
                var secondDevice = secondSettings.Content.KnownDevices
                    .First(d => d.DeviceId == device.DeviceId);

                var firstTimestamp = firstTimestamps[device.DeviceId!];
                var secondTimestamp = secondDevice.IndexingStatus.SdLastIndexed;

                secondTimestamp.Should().NotBeNull();
                secondTimestamp.Should().BeAfter(firstTimestamp!.Value,
                    "second indexing should update timestamp to later value");
                secondTimestamp.Should().BeAfter(beforeSecondIndex);
                secondTimestamp.Should().BeBefore(afterSecondIndex);
            }
        }
    }
}
