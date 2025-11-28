using System.Net;
using FluentAssertions;
using TeensyRom.Api.Endpoints.Settings.GetSettings;

namespace TeensyRom.Api.Tests.Integration
{
    [Collection("Endpoint")]
    public class GetSettingsTests(EndpointFixture f) : IDisposable
    {
        [Fact]
        public async Task GetSettings_ReturnsDefaultSettings()
        {
            // Act
            var r = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();

            // Assert
            r.Should().BeSuccessful<GetSettingsResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            r.Content.Should().NotBeNull();
            r.Content.KnownDevices.Should().NotBeNull();
            r.Content.PlayerSettings.Should().NotBeNull();
            r.Content.FileTransferSettings.Should().NotBeNull();
            r.Content.SearchSettings.Should().NotBeNull();
            r.Content.AppSettings.Should().NotBeNull();
        }

        [Fact]
        public async Task GetSettings_ReturnsValidStructure()
        {
            // Act
            var r = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();

            // Assert
            r.Should().BeSuccessful<GetSettingsResponse>();

            var settings = r.Content;
            
            // Verify KnownDevices structure
            settings.KnownDevices.Should().NotBeNull();
            // KnownDevices may be empty on fresh install, which is valid
            
            // If devices exist, verify their structure
            if (settings.KnownDevices.Any())
            {
                var device = settings.KnownDevices.First();
                device.DeviceId.Should().NotBeNullOrEmpty();
                device.VideoSettings.Should().NotBeNull();
                device.ConnectionSettings.Should().NotBeNull();
                device.ConnectionSettings.ConnectionType.Should().BeDefined();
            }

            // Verify PlayerSettings structure
            settings.PlayerSettings.StartupFilter.Should().BeDefined();

            // Verify FileTransferSettings structure
            settings.FileTransferSettings.AutoTransferPath.Should().NotBeNull();

            // Verify SearchSettings structure
            settings.SearchSettings.SearchWeights.Should().NotBeNull();
            settings.SearchSettings.SearchStopWords.Should().NotBeNull();
            settings.SearchSettings.BannedDirectories.Should().NotBeNull();
            settings.SearchSettings.BannedFiles.Should().NotBeNull();

            // Verify SearchWeights structure
            var weights = settings.SearchSettings.SearchWeights;
            weights.Title.Should().BeGreaterThanOrEqualTo(0);
            weights.FileName.Should().BeGreaterThanOrEqualTo(0);
            weights.FilePath.Should().BeGreaterThanOrEqualTo(0);
            weights.Creator.Should().BeGreaterThanOrEqualTo(0);
            weights.Description.Should().BeGreaterThanOrEqualTo(0);
        }

        [Fact]
        public async Task GetSettings_Returns200OK()
        {
            // Act
            var r = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();

            // Assert
            r.Http.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        public void Dispose()
        {
            // Settings tests don't require device reset since they only interact with local settings service
        }
    }
}
