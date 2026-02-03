using System.Net;
using FluentAssertions;
using TeensyRom.Api.Endpoints.Files.Index;
using TeensyRom.Api.Endpoints.Settings.GetSettings;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Tests.Integration.Files
{
    [Collection("Endpoint")]
    public class IndexEndpointTests(EndpointFixture f) : IDisposable
    {
        [Fact]
        public async Task Index_WhenCacheAll_SavesTimestampToDeviceSettings()
        {
            // Arrange
            var deviceId = await f.GetConnectedDevice();
            f.DeleteCache(deviceId, TeensyStorageType.SD);

            // Get initial settings to verify timestamp starts as null
            var initialSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();
            var initialDevice = initialSettings.Content.KnownDevices.FirstOrDefault(d => d.DeviceId == deviceId);
            
            // Act - Full index with no starting path (CacheAll)
            var beforeIndex = DateTime.UtcNow.AddSeconds(-1); // Buffer for timestamp comparison
            var request = new IndexRequest
            {
                DeviceId = deviceId,
                StorageType = TeensyStorageType.SD,
                StartingPath = null
            };
            var response = await f.Client.PostAsync<IndexEndpoint, IndexRequest, IndexResponse>(request);
            var afterIndex = DateTime.UtcNow.AddSeconds(1); // Buffer for timestamp comparison

            // Assert - Verify successful indexing
            response.Should().BeSuccessful<IndexResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            // Verify timestamp was saved
            var updatedSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();
            var updatedDevice = updatedSettings.Content.KnownDevices.First(d => d.DeviceId == deviceId);
            
            updatedDevice.IndexingStatus.Should().NotBeNull();
            updatedDevice.IndexingStatus.SdLastIndexed.Should().NotBeNull("full index should save timestamp");
            updatedDevice.IndexingStatus.SdLastIndexed.Should().BeAfter(beforeIndex);
            updatedDevice.IndexingStatus.SdLastIndexed.Should().BeBefore(afterIndex);
        }

        [Fact]
        public async Task Index_WhenCacheRootPath_SavesTimestampToDeviceSettings()
        {
            // Arrange
            var deviceId = await f.GetConnectedDevice();
            f.DeleteCache(deviceId, TeensyStorageType.SD);

            // Act - Full index with root path "/"
            var beforeIndex = DateTime.UtcNow.AddSeconds(-1);
            var request = new IndexRequest
            {
                DeviceId = deviceId,
                StorageType = TeensyStorageType.SD,
                StartingPath = "/"
            };
            var response = await f.Client.PostAsync<IndexEndpoint, IndexRequest, IndexResponse>(request);
            var afterIndex = DateTime.UtcNow.AddSeconds(1);

            // Assert - Verify successful indexing
            response.Should().BeSuccessful<IndexResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            // Verify timestamp was saved
            var updatedSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();
            var updatedDevice = updatedSettings.Content.KnownDevices.First(d => d.DeviceId == deviceId);
            
            updatedDevice.IndexingStatus.Should().NotBeNull();
            updatedDevice.IndexingStatus.SdLastIndexed.Should().NotBeNull("root path index should save timestamp");
            updatedDevice.IndexingStatus.SdLastIndexed.Should().BeAfter(beforeIndex);
            updatedDevice.IndexingStatus.SdLastIndexed.Should().BeBefore(afterIndex);
        }

        [Fact]
        public async Task Index_WhenCacheSubdirectory_DoesNotSaveTimestamp()
        {
            // Arrange
            var deviceId = await f.GetConnectedDevice();
            f.DeleteCache(deviceId, TeensyStorageType.SD);

            // Get initial settings
            var initialSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();
            var initialDevice = initialSettings.Content.KnownDevices.FirstOrDefault(d => d.DeviceId == deviceId);
            var initialTimestamp = initialDevice?.IndexingStatus?.SdLastIndexed;

            // Act - Partial index with subdirectory path
            var request = new IndexRequest
            {
                DeviceId = deviceId,
                StorageType = TeensyStorageType.SD,
                StartingPath = "/games"
            };
            var response = await f.Client.PostAsync<IndexEndpoint, IndexRequest, IndexResponse>(request);

            // Assert - Verify successful indexing
            response.Should().BeSuccessful<IndexResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            // Verify timestamp was NOT saved (should remain unchanged)
            var updatedSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();
            var updatedDevice = updatedSettings.Content.KnownDevices.First(d => d.DeviceId == deviceId);
            
            updatedDevice.IndexingStatus.Should().NotBeNull();
            updatedDevice.IndexingStatus.SdLastIndexed.Should().Be(initialTimestamp, 
                "subdirectory index should not update timestamp");
        }

        [Fact]
        public async Task Index_WhenUsbStorageType_UpdatesUsbTimestamp()
        {
            // Arrange
            var deviceId = await f.GetConnectedDevice();
            f.DeleteCache(deviceId, TeensyStorageType.USB);

            // Get initial settings
            var initialSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();
            var initialDevice = initialSettings.Content.KnownDevices.FirstOrDefault(d => d.DeviceId == deviceId);
            var initialSdTimestamp = initialDevice?.IndexingStatus?.SdLastIndexed;

            // Act - Full index of USB storage
            var beforeIndex = DateTime.UtcNow.AddSeconds(-1);
            var request = new IndexRequest
            {
                DeviceId = deviceId,
                StorageType = TeensyStorageType.USB,
                StartingPath = null
            };
            var response = await f.Client.PostAsync<IndexEndpoint, IndexRequest, IndexResponse>(request);
            var afterIndex = DateTime.UtcNow.AddSeconds(1);

            // Assert - Verify successful indexing
            response.Should().BeSuccessful<IndexResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            // Verify USB timestamp was saved and SD timestamp unchanged
            var updatedSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();
            var updatedDevice = updatedSettings.Content.KnownDevices.First(d => d.DeviceId == deviceId);
            
            updatedDevice.IndexingStatus.Should().NotBeNull();
            updatedDevice.IndexingStatus.UsbLastIndexed.Should().NotBeNull("USB full index should save USB timestamp");
            updatedDevice.IndexingStatus.UsbLastIndexed.Should().BeAfter(beforeIndex);
            updatedDevice.IndexingStatus.UsbLastIndexed.Should().BeBefore(afterIndex);
            updatedDevice.IndexingStatus.SdLastIndexed.Should().Be(initialSdTimestamp, 
                "USB indexing should not affect SD timestamp");
        }

        [Fact]
        public async Task Index_WhenSdStorageType_UpdatesSdTimestamp()
        {
            // Arrange
            var deviceId = await f.GetConnectedDevice();
            f.DeleteCache(deviceId, TeensyStorageType.SD);

            // Get initial settings
            var initialSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();
            var initialDevice = initialSettings.Content.KnownDevices.FirstOrDefault(d => d.DeviceId == deviceId);
            var initialUsbTimestamp = initialDevice?.IndexingStatus?.UsbLastIndexed;

            // Act - Full index of SD storage
            var beforeIndex = DateTime.UtcNow.AddSeconds(-1);
            var request = new IndexRequest
            {
                DeviceId = deviceId,
                StorageType = TeensyStorageType.SD,
                StartingPath = null
            };
            var response = await f.Client.PostAsync<IndexEndpoint, IndexRequest, IndexResponse>(request);
            var afterIndex = DateTime.UtcNow.AddSeconds(1);

            // Assert - Verify successful indexing
            response.Should().BeSuccessful<IndexResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            // Verify SD timestamp was saved and USB timestamp unchanged
            var updatedSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();
            var updatedDevice = updatedSettings.Content.KnownDevices.First(d => d.DeviceId == deviceId);
            
            updatedDevice.IndexingStatus.Should().NotBeNull();
            updatedDevice.IndexingStatus.SdLastIndexed.Should().NotBeNull("SD full index should save SD timestamp");
            updatedDevice.IndexingStatus.SdLastIndexed.Should().BeAfter(beforeIndex);
            updatedDevice.IndexingStatus.SdLastIndexed.Should().BeBefore(afterIndex);
            updatedDevice.IndexingStatus.UsbLastIndexed.Should().Be(initialUsbTimestamp, 
                "SD indexing should not affect USB timestamp");
        }

        [Fact]
        public async Task Index_MultipleFullIndexes_UpdatesTimestampToLatest()
        {
            // Arrange
            var deviceId = await f.GetConnectedDevice();
            f.DeleteCache(deviceId, TeensyStorageType.SD);

            // Act - First full index
            var firstRequest = new IndexRequest
            {
                DeviceId = deviceId,
                StorageType = TeensyStorageType.SD,
                StartingPath = null
            };
            await f.Client.PostAsync<IndexEndpoint, IndexRequest, IndexResponse>(firstRequest);
            
            // Get timestamp from first index
            var firstSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();
            var firstDevice = firstSettings.Content.KnownDevices.First(d => d.DeviceId == deviceId);
            var firstTimestamp = firstDevice.IndexingStatus.SdLastIndexed;

            // Wait a bit to ensure timestamps differ
            await Task.Delay(1000);

            // Act - Second full index
            var secondRequest = new IndexRequest
            {
                DeviceId = deviceId,
                StorageType = TeensyStorageType.SD,
                StartingPath = "/"
            };
            await f.Client.PostAsync<IndexEndpoint, IndexRequest, IndexResponse>(secondRequest);

            // Assert - Verify timestamp was updated
            var secondSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();
            var secondDevice = secondSettings.Content.KnownDevices.First(d => d.DeviceId == deviceId);
            var secondTimestamp = secondDevice.IndexingStatus.SdLastIndexed;

            secondTimestamp.Should().NotBeNull();
            secondTimestamp.Should().BeAfter(firstTimestamp!.Value, 
                "second full index should update timestamp to later value");
        }

        public void Dispose()
        {
            // Clean up - no specific cleanup needed for these tests
            // Timestamps in settings are non-destructive
        }
    }
}
