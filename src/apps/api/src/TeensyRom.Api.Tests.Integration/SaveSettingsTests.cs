using System.Net;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using TeensyRom.Api.Endpoints.Settings;
using TeensyRom.Api.Endpoints.Settings.GetSettings;
using TeensyRom.Api.Endpoints.Settings.SaveSettings;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Tests.Integration
{
    [Collection("Endpoint")]
    public class SaveSettingsTests(EndpointFixture f) : IDisposable
    {
        private SaveSettingsRequest CreateValidRequest()
        {
            return new SaveSettingsRequest
            {
                KnownDevices = new List<DeviceSettingsDto>
                {
                    new DeviceSettingsDto
                    {
                        DeviceId = "TEST_DEVICE_123",
                        VideoSettings = new VideoSettingsDto
                        {
                            EnableVideo = false,
                            VideoDeviceId = string.Empty
                        },
                        ConnectionSettings = new ConnectionSettingsDto
                        {
                            ConnectionType = ConnectionType.Serial,
                            AutoConnectEnabled = true
                        }
                    }
                },
                PlayerSettings = new PlayerSettingsDto
                {
                    RepeatModeOnStartup = false,
                    PlayTimerEnabled = true,
                    MuteFastForward = false,
                    MuteRandomSeek = false,
                    StartupFilter = TeensyFilterType.All,
                    StartupLaunchEnabled = true,
                    StartupLaunchRandom = false
                },
                FileTransferSettings = new FileTransferSettingsDto
                {
                    WatchDirectoryLocation = @"C:\Users\Test\Downloads",
                    AutoTransferPath = "auto-transfer",
                    AutoFileCopyEnabled = false,
                    AutoLaunchOnCopyEnabled = true,
                    NavToDirOnLaunch = true,
                    SyncFilesEnabled = false
                },
                SearchSettings = new SearchSettingsDto
                {
                    SearchWeights = new SearchWeightsDto
                    {
                        Title = 1.0,
                        FileName = 0.1,
                        FilePath = 0.1,
                        Creator = 0.1,
                        Description = 1.0
                    },
                    SearchStopWords = new List<string> { "a", "an", "the" },
                    BannedDirectories = new List<string> { "System Volume Information" },
                    BannedFiles = new List<string> { "test.sid" }
                },
                AppSettings = new AppSettingsDto
                {
                    FirstTimeSetup = false
                }
            };
        }

        [Fact]
        public async Task SaveSettings_WithValidRequest_SavesSuccessfullyAndReturnsSettings()
        {
            // Arrange
            var request = CreateValidRequest();

            // Act
            var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, SaveSettingsResponse>(request);

            // Assert
            r.Should().BeSuccessful<SaveSettingsResponse>()
                .WithStatusCode(HttpStatusCode.OK)
                .WithContentNotNull();

            r.Content.Message.Should().Be("Settings saved successfully.");
        }

        //[Fact]
        //public async Task SaveSettings_WithInvalidBaudRate_ReturnsBadRequest()
        //{
        //    // Arrange
        //    var request = CreateValidRequest();
        //    request.ConnectionSettings.Serial.BaudRate = -1;

        //    // Act
        //    var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, ValidationProblemDetails>(request);

        //    // Assert
        //    r.Should().BeValidationProblem()
        //        .WithKey("ConnectionSettings.Serial.BaudRate");
        //}

        //[Fact]
        //public async Task SaveSettings_WithInvalidBaudRateValue_ReturnsBadRequest()
        //{
        //    // Arrange
        //    var request = CreateValidRequest();
        //    request.ConnectionSettings.Serial.BaudRate = 12345; // Not a standard baud rate

        //    // Act
        //    var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, ValidationProblemDetails>(request);

        //    // Assert
        //    r.Should().BeValidationProblem()
        //        .WithKeyAndValue("ConnectionSettings.Serial.BaudRate", "Baud rate should be one of: 9600, 19200, 38400, 57600, or 115200.");
        //}

        //[Fact]
        //public async Task SaveSettings_WithInvalidTcpPort_ReturnsBadRequest()
        //{
        //    // Arrange
        //    var request = CreateValidRequest();
        //    request.ConnectionSettings.Tcp.Port = 70000; // Out of valid range

        //    // Act
        //    var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, ValidationProblemDetails>(request);

        //    // Assert
        //    r.Should().BeValidationProblem()
        //        .WithKeyAndValue("ConnectionSettings.Tcp.Port", "TCP port must be between 1 and 65535.");
        //}

        //[Fact]
        //public async Task SaveSettings_WithInvalidTcpPortZero_ReturnsBadRequest()
        //{
        //    // Arrange
        //    var request = CreateValidRequest();
        //    request.ConnectionSettings.Tcp.Port = 0;

        //    // Act
        //    var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, ValidationProblemDetails>(request);

        //    // Assert
        //    r.Should().BeValidationProblem()
        //        .WithKey("ConnectionSettings.Tcp.Port");
        //}

        //[Fact]
        //public async Task SaveSettings_WithInvalidTimeouts_ReturnsBadRequest()
        //{
        //    // Arrange
        //    var request = CreateValidRequest();
        //    request.ConnectionSettings.Tcp.ConnectionTimeoutMs = -100;

        //    // Act
        //    var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, ValidationProblemDetails>(request);

        //    // Assert
        //    r.Should().BeValidationProblem()
        //        .WithKey("ConnectionSettings.Tcp.ConnectionTimeoutMs");
        //}

        //[Fact]
        //public async Task SaveSettings_WithNegativeReadTimeout_ReturnsBadRequest()
        //{
        //    // Arrange
        //    var request = CreateValidRequest();
        //    request.ConnectionSettings.Tcp.ReadTimeoutMs = -50;

        //    // Act
        //    var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, ValidationProblemDetails>(request);

        //    // Assert
        //    r.Should().BeValidationProblem()
        //        .WithKey("ConnectionSettings.Tcp.ReadTimeoutMs");
        //}

        //[Fact]
        //public async Task SaveSettings_WithNegativeWriteTimeout_ReturnsBadRequest()
        //{
        //    // Arrange
        //    var request = CreateValidRequest();
        //    request.ConnectionSettings.Tcp.WriteTimeoutMs = 0;

        //    // Act
        //    var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, ValidationProblemDetails>(request);

        //    // Assert
        //    r.Should().BeValidationProblem()
        //        .WithKey("ConnectionSettings.Tcp.WriteTimeoutMs");
        //}

        [Fact]
        public async Task SaveSettings_WithInvalidConnectionType_ReturnsBadRequest()
        {
            // Arrange
            var request = CreateValidRequest();
            request.KnownDevices[0].ConnectionSettings.ConnectionType = (ConnectionType)999;

            // Act
            var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, ValidationProblemDetails>(request);

            // Assert
            r.Should().BeValidationProblem()
                .WithKey("KnownDevices[0].ConnectionSettings.ConnectionType");
        }

        [Fact]
        public async Task SaveSettings_WithInvalidStartupFilter_ReturnsBadRequest()
        {
            // Arrange
            var request = CreateValidRequest();
            request.PlayerSettings.StartupFilter = (TeensyFilterType)999;

            // Act
            var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, ValidationProblemDetails>(request);

            // Assert
            r.Should().BeValidationProblem()
                .WithKey("PlayerSettings.StartupFilter");
        }

        [Fact]
        public async Task SaveSettings_WithNegativeSearchWeights_ReturnsBadRequest()
        {
            // Arrange
            var request = CreateValidRequest();
            request.SearchSettings.SearchWeights.Title = -0.5;

            // Act
            var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, ValidationProblemDetails>(request);

            // Assert
            r.Should().BeValidationProblem()
                .WithKey("SearchSettings.SearchWeights.Title");
        }

        [Fact]
        public async Task SaveSettings_WithAllZeroSearchWeights_ReturnsBadRequest()
        {
            // Arrange
            var request = CreateValidRequest();
            request.SearchSettings.SearchWeights = new SearchWeightsDto
            {
                Title = 0,
                FileName = 0,
                FilePath = 0,
                Creator = 0,
                Description = 0
            };

            // Act
            var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, ValidationProblemDetails>(request);

            // Assert
            r.Should().BeValidationProblem()
                .WithKeyAndValue("SearchSettings.SearchWeights", "At least one search weight must be greater than 0 for meaningful search.");
        }

        //[Fact]
        //public async Task SaveSettings_SettingsPersist_BetweenRequests()
        //{
        //    // Arrange - Save settings with unique value
        //    var saveRequest = CreateValidRequest();
        //    saveRequest.ConnectionSettings.Serial.Port = "COM7";

        //    // Act - Save
        //    var saveResponse = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, SaveSettingsResponse>(saveRequest);
        //    saveResponse.Should().BeSuccessful<SaveSettingsResponse>();

        //    // Act - Retrieve
        //    var getResponse = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();

        //    // Assert - Verify persisted
        //    getResponse.Should().BeSuccessful<GetSettingsResponse>();
        //    //getResponse.Content.ConnectionSettings.Serial.Port.Should().Be("COM7");
        //}

        [Fact]
        public async Task SaveSettings_UpdatesOnlyChangedSection_OtherSectionsUnchanged()
        {
            // Arrange - Get initial settings
            var initialSettings = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();
            initialSettings.Should().BeSuccessful<GetSettingsResponse>();

            var initialPlayerFilter = initialSettings.Content.PlayerSettings.StartupFilter;
            var initialDeviceCount = initialSettings.Content.KnownDevices.Count;

            // Arrange - Modify only player settings
            var saveRequest = CreateValidRequest();
            saveRequest.PlayerSettings.StartupFilter = TeensyFilterType.Music;
            saveRequest.KnownDevices = initialSettings.Content.KnownDevices; // Keep existing devices

            // Act - Save
            var saveResponse = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, SaveSettingsResponse>(saveRequest);
            saveResponse.Should().BeSuccessful<SaveSettingsResponse>();

            // Act - Retrieve
            var getResponse = await f.Client.GetAsync<GetSettingsEndpoint, GetSettingsResponse>();

            // Assert - Verify changes
            getResponse.Should().BeSuccessful<GetSettingsResponse>();
            getResponse.Content.PlayerSettings.StartupFilter.Should().Be(TeensyFilterType.Music);
            getResponse.Content.KnownDevices.Count.Should().Be(initialDeviceCount);
        }

        //[Fact]
        //public async Task SaveSettings_WithEmptyPort_IsValid()
        //{
        //    // Arrange - Empty port means auto-detect
        //    var request = CreateValidRequest();
        //    request.ConnectionSettings.Serial.Port = string.Empty;

        //    // Act
        //    var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, SaveSettingsResponse>(request);

        //    // Assert
        //    r.Should().BeSuccessful<SaveSettingsResponse>();
        //}

        //[Fact]
        //public async Task SaveSettings_WithEmptyHostAddress_IsValid()
        //{
        //    // Arrange - Empty host means not configured
        //    var request = CreateValidRequest();
        //    request.ConnectionSettings.Tcp.HostAddress = string.Empty;

        //    // Act
        //    var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, SaveSettingsResponse>(request);

        //    // Assert
        //    r.Should().BeSuccessful<SaveSettingsResponse>();
        //}

        [Fact]
        public async Task SaveSettings_WithEmptyWatchDirectory_IsValid()
        {
            // Arrange - Empty watch directory is valid (not configured)
            var request = CreateValidRequest();
            request.FileTransferSettings.WatchDirectoryLocation = string.Empty;

            // Act
            var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, SaveSettingsResponse>(request);

            // Assert
            r.Should().BeSuccessful<SaveSettingsResponse>();
        }

        [Fact]
        public async Task SaveSettings_WithEmptyLists_IsValid()
        {
            // Arrange - Empty lists are valid
            var request = CreateValidRequest();
            request.SearchSettings.SearchStopWords = [];
            request.SearchSettings.BannedDirectories = [];
            request.SearchSettings.BannedFiles = [];

            // Act
            var r = await f.Client.PostAsync<SaveSettingsEndpoint, SaveSettingsRequest, SaveSettingsResponse>(request);

            // Assert
            r.Should().BeSuccessful<SaveSettingsResponse>();
        }

        public void Dispose()
        {
            // Settings tests don't require device reset since they only interact with local settings service
        }
    }
}
