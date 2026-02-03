using System.Reactive.Linq;
using System.Reactive.Threading.Tasks;
using System.Reflection;
using AutoFixture;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;

namespace TeensyRom.Core.Tests.Settings;

/// <summary>
/// Comprehensive behavioral tests for SettingsService functionality.
/// Tests focus on service behavior, file I/O, observable patterns, and provider interfaces.
/// File operations write to the test assembly's output directory for isolation.
/// </summary>
public class SettingsServiceTests : IDisposable
{
    private readonly IFixture _fixture;
    private readonly ILoggingService _mockLogger;
    private readonly string _settingsFilePath;
    private readonly string _testWatchDirectory;

    public SettingsServiceTests()
    {
        _fixture = new Fixture();
        _mockLogger = Substitute.For<ILoggingService>();
        
        // Get the actual path where the service will write
        var assemblyPath = Assembly.GetExecutingAssembly().GetPath();
        _settingsFilePath = Path.Combine(assemblyPath, SettingsConstants.SettingsPath);
        
        // Create a test watch directory that will exist for validation tests
        _testWatchDirectory = Path.Combine(Path.GetTempPath(), "TeensyRomTests", "WatchDir");
        Directory.CreateDirectory(_testWatchDirectory);
    }

    public void Dispose()
    {
        // Cleanup: Remove the settings file if it exists
        try
        {
            if (File.Exists(_settingsFilePath))
            {
                File.Delete(_settingsFilePath);
            }
            
            var settingsDir = Path.GetDirectoryName(_settingsFilePath);
            if (Directory.Exists(settingsDir) && !Directory.EnumerateFileSystemEntries(settingsDir!).Any())
            {
                Directory.Delete(settingsDir!, false);
            }

            if (Directory.Exists(_testWatchDirectory))
            {
                Directory.Delete(_testWatchDirectory, true);
            }
        }
        catch
        {
            // Best effort cleanup
        }
    }

    #region Constructor and Initialization Tests

    [Fact]
    public void Constructor_ShouldInitializeService_WithDefaultSettings()
    {
        // Arrange & Act
        var service = new SettingsService(_mockLogger);

        // Assert
        service.Should().NotBeNull();
        var settings = service.GetSettings();
        settings.Should().NotBeNull();
    }

    [Fact]
    public void Constructor_ShouldCreateDefaultSettings_WhenFileDoesNotExist()
    {
        // Arrange - Ensure no settings file exists
        if (File.Exists(_settingsFilePath))
        {
            File.Delete(_settingsFilePath);
        }

        // Act
        var service = new SettingsService(_mockLogger);
        var settings = service.GetSettings();

        // Assert
        settings.Should().NotBeNull();
        settings.KnownDevices.Should().NotBeNull();
        settings.PlayerSettings.Should().NotBeNull();
        settings.FileTransferSettings.Should().NotBeNull();
        settings.FileTransferSettings.WatchDirectoryLocation.Should().NotBeNullOrEmpty();
        settings.SearchSettings.Should().NotBeNull();
        settings.SearchSettings.BannedDirectories.Should().NotBeEmpty();
        settings.AppSettings.Should().NotBeNull();
        settings.AppSettings.FirstTimeSetup.Should().BeTrue();
    }

    [Fact]
    public void Constructor_ShouldCreateDirectoryAndFile_WhenNotExist()
    {
        // Arrange - Clean up any existing file
        if (File.Exists(_settingsFilePath))
        {
            File.Delete(_settingsFilePath);
        }

        // Act
        var service = new SettingsService(_mockLogger);
        service.GetSettings(); // Force initialization

        // Assert
        Directory.Exists(Path.GetDirectoryName(_settingsFilePath)).Should().BeTrue();
        File.Exists(_settingsFilePath).Should().BeTrue();
    }

    [Fact]
    public void Constructor_ShouldEmitInitialSettings_ToObservable()
    {
        // Arrange
        TeensySettings? emittedSettings = null;
        var service = new SettingsService(_mockLogger);

        // Act
        service.Settings.Take(1).Subscribe(s => emittedSettings = s);

        // Assert
        emittedSettings.Should().NotBeNull();
    }

    #endregion

    #region GetSettings Tests

    [Fact]
    public void GetSettings_ShouldReturnCachedSettings_OnMultipleCalls()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);

        // Act
        var settings1 = service.GetSettings();
        var settings2 = service.GetSettings();

        // Assert - Should return equivalent data (records create new instances with 'with {}')
        settings1.Should().BeEquivalentTo(settings2);
    }

    [Fact]
    public void GetSettings_ShouldReturnCopyOfSettings_NotOriginal()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var originalSettings = service.GetSettings();
        var originalFirstTimeSetup = originalSettings.AppSettings.FirstTimeSetup;

        // Act - Attempt to modify through the API (but GetSettings returns a new copy each time)
        var copiedSettings = service.GetSettings();
        
        // Modify using proper record syntax to create a new instance
        var modifiedSettings = copiedSettings with
        {
            AppSettings = copiedSettings.AppSettings with
            {
                FirstTimeSetup = !originalFirstTimeSetup
            }
        };
        
        // We're not saving this, just verifying the original cached value is unchanged
        
        // Assert - Original cached value should not be affected since we didn't save
        var refreshedSettings = service.GetSettings();
        refreshedSettings.AppSettings.FirstTimeSetup.Should().Be(originalFirstTimeSetup);
    }

    [Fact]
    public void GetSettings_ShouldDeserializeAllSettingsSections_Correctly()
    {
        // Arrange - Create settings with specific values
        if (File.Exists(_settingsFilePath))
        {
            File.Delete(_settingsFilePath);
        }

        var service = new SettingsService(_mockLogger);
        var expectedSettings = new TeensySettings
        {
            PlayerSettings = new PlayerSettings 
            { 
                RepeatModeOnStartup = true,
                PlayTimerEnabled = true
            },
            FileTransferSettings = new FileTransferSettings 
            { 
                AutoFileCopyEnabled = true,
                SyncFilesEnabled = true
            },
            SearchSettings = new SearchSettings 
            { 
                BannedFiles = new List<string> { "test1.sid", "test2.sid" }
            },
            AppSettings = new AppSettings 
            { 
                FirstTimeSetup = false
            }
        };

        // Act - Save and reload
        service.SaveSettings(expectedSettings);
        var newService = new SettingsService(_mockLogger);
        var actualSettings = newService.GetSettings();

        // Assert
        actualSettings.PlayerSettings.RepeatModeOnStartup.Should().Be(expectedSettings.PlayerSettings.RepeatModeOnStartup);
        actualSettings.FileTransferSettings.AutoFileCopyEnabled.Should().Be(expectedSettings.FileTransferSettings.AutoFileCopyEnabled);
        actualSettings.SearchSettings.BannedFiles.Should().BeEquivalentTo(expectedSettings.SearchSettings.BannedFiles);
        actualSettings.AppSettings.FirstTimeSetup.Should().Be(expectedSettings.AppSettings.FirstTimeSetup);
    }

    #endregion

    #region SaveSettings Tests

    [Fact]
    public void SaveSettings_ShouldPersistSettingsToDisk()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var newSettings = service.GetSettings();
        newSettings = newSettings with
        {
            AppSettings = newSettings.AppSettings with
            {
                FirstTimeSetup = false
            }
        };

        // Act
        var result = service.SaveSettings(newSettings);

        // Assert
        result.Should().BeTrue();
        File.Exists(_settingsFilePath).Should().BeTrue();
        
        // Verify by reading the file directly
        var fileContent = File.ReadAllText(_settingsFilePath);
        fileContent.Should().Contain("\"firstTimeSetup\"");
        fileContent.Should().Contain("false"); // FirstTimeSetup value
    }

    [Fact]
    public void SaveSettings_ShouldUpdateCachedSettings()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var newSettings = service.GetSettings();
        newSettings = newSettings with
        {
            PlayerSettings = newSettings.PlayerSettings with
            {
                RepeatModeOnStartup = !newSettings.PlayerSettings.RepeatModeOnStartup
            }
        };

        // Act
        service.SaveSettings(newSettings);
        var retrievedSettings = service.GetSettings();

        // Assert
        retrievedSettings.PlayerSettings.RepeatModeOnStartup.Should().Be(newSettings.PlayerSettings.RepeatModeOnStartup);
    }

    [Fact]
    public void SaveSettings_ShouldEmitNewSettings_ToObservable()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var initialSettings = service.GetSettings();
        var newSettings = initialSettings with 
        { 
            AppSettings = initialSettings.AppSettings with 
            { 
                FirstTimeSetup = !initialSettings.AppSettings.FirstTimeSetup 
            } 
        };
        TeensySettings? emittedSettings = null;
        
        // Subscribe after initial emission
        service.Settings.Skip(1).Take(1).Subscribe(s => emittedSettings = s);

        // Act
        service.SaveSettings(newSettings);

        // Assert
        emittedSettings.Should().NotBeNull();
        emittedSettings!.AppSettings.FirstTimeSetup.Should().Be(newSettings.AppSettings.FirstTimeSetup);
    }

    [Fact]
    public void SaveSettings_ShouldOverwriteExistingFile()
    {
        // Arrange
        var service1 = new SettingsService(_mockLogger);
        var initialSettings = service1.GetSettings();
        initialSettings = initialSettings with
        {
            PlayerSettings = initialSettings.PlayerSettings with
            {
                PlayTimerEnabled = true
            }
        };
        service1.SaveSettings(initialSettings);
        
        var service2 = new SettingsService(_mockLogger);
        var newSettings = service2.GetSettings();
        newSettings = newSettings with
        {
            PlayerSettings = newSettings.PlayerSettings with
            {
                PlayTimerEnabled = false
            }
        };

        // Act
        service2.SaveSettings(newSettings);

        // Assert
        var service3 = new SettingsService(_mockLogger);
        var retrievedSettings = service3.GetSettings();
        retrievedSettings.PlayerSettings.PlayTimerEnabled.Should().BeFalse();
    }

    [Fact]
    public async Task SaveSettings_ShouldHandleMultipleConcurrentSaves()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var tasks = new List<Task>();

        // Act
        for (int i = 0; i < 10; i++)
        {
            var localI = i;
            tasks.Add(Task.Run(() =>
            {
                var settings = service.GetSettings();
                settings = settings with
                {
                    SearchSettings = settings.SearchSettings with
                    {
                        BannedFiles = new List<string> { $"test-file-{localI}.sid" }
                    }
                };
                service.SaveSettings(settings);
            }));
        }

        await Task.WhenAll(tasks);

        // Assert
        File.Exists(_settingsFilePath).Should().BeTrue();
        var finalSettings = service.GetSettings();
        finalSettings.Should().NotBeNull();
        finalSettings.SearchSettings.BannedFiles.Should().NotBeEmpty();
    }

    #endregion

    #region Observable Behavior Tests

    [Fact]
    public async Task Settings_Observable_ShouldEmitInitialValue_Immediately()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        TeensySettings? receivedSettings = null;

        // Act
        await service.Settings
            .Take(1)
            .Do(s => receivedSettings = s)
            .ToTask();

        // Assert
        receivedSettings.Should().NotBeNull();
    }

    [Fact]
    public async Task Settings_Observable_ShouldEmitUpdates_WhenSettingsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var emittedSettings = new List<TeensySettings>();
        var subscription = service.Settings.Subscribe(emittedSettings.Add);

        var newSettings = service.GetSettings();
        newSettings = newSettings with
        {
            AppSettings = newSettings.AppSettings with
            {
                FirstTimeSetup = false
            }
        };

        // Act
        service.SaveSettings(newSettings);
        await Task.Delay(100); // Allow observable to emit

        // Assert
        subscription.Dispose();
        emittedSettings.Should().HaveCountGreaterThanOrEqualTo(2); // Initial + updated
        emittedSettings.Last().AppSettings.FirstTimeSetup.Should().BeFalse();
    }

    [Fact]
    public async Task Settings_Observable_ShouldSupportMultipleSubscribers()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var subscriber1Values = new List<TeensySettings>();
        var subscriber2Values = new List<TeensySettings>();

        var sub1 = service.Settings.Subscribe(subscriber1Values.Add);
        var sub2 = service.Settings.Subscribe(subscriber2Values.Add);

        var newSettings = service.GetSettings();
        newSettings = newSettings with
        {
            AppSettings = newSettings.AppSettings with
            {
                FirstTimeSetup = !newSettings.AppSettings.FirstTimeSetup
            }
        };

        // Act
        service.SaveSettings(newSettings);
        await Task.Delay(100);

        // Assert
        sub1.Dispose();
        sub2.Dispose();
        
        subscriber1Values.Should().HaveCountGreaterThanOrEqualTo(2);
        subscriber2Values.Should().HaveCountGreaterThanOrEqualTo(2);
        subscriber1Values.Last().AppSettings.FirstTimeSetup.Should().Be(subscriber2Values.Last().AppSettings.FirstTimeSetup);
    }

    #endregion

    #region Provider Interface Tests - IDeviceSettingsProvider

    [Fact]
    public void GetDeviceSettings_ShouldReturnNull_WhenDeviceNotFound()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var nonExistentDeviceId = "NON_EXISTENT_DEVICE";

        // Act
        var deviceSettings = service.GetDeviceSettings(nonExistentDeviceId);

        // Assert
        deviceSettings.Should().BeNull();
    }

    [Fact]
    public void GetDeviceSettings_ShouldReturnDeviceSettings_WhenDeviceExists()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var testDeviceId = "TEST_DEVICE_123";
        
        // Create a device first
        var created = service.GetOrCreateDeviceSettings(testDeviceId);

        // Act
        var retrieved = service.GetDeviceSettings(testDeviceId);

        // Assert
        retrieved.Should().NotBeNull();
        retrieved!.DeviceId.Should().Be(testDeviceId);
        retrieved.Should().BeEquivalentTo(created);
    }

    [Fact]
    public void GetOrCreateDeviceSettings_ShouldCreateNewDevice_WithDefaultValues()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var newDeviceId = "NEW_DEVICE_456";

        // Act
        var deviceSettings = service.GetOrCreateDeviceSettings(newDeviceId);

        // Assert
        deviceSettings.Should().NotBeNull();
        deviceSettings.DeviceId.Should().Be(newDeviceId);
        deviceSettings.VideoSettings.Should().NotBeNull();
        deviceSettings.VideoSettings.EnableVideo.Should().BeFalse();
        deviceSettings.ConnectionSettings.Should().NotBeNull();
        deviceSettings.ConnectionSettings.AutoConnectEnabled.Should().BeTrue();
    }

    [Fact]
    public void GetOrCreateDeviceSettings_ShouldReturnExistingDevice_WhenAlreadyExists()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var deviceId = "EXISTING_DEVICE_789";
        var firstCall = service.GetOrCreateDeviceSettings(deviceId);
        
        // Modify the device
        firstCall = firstCall with
        {
            VideoSettings = firstCall.VideoSettings with { EnableVideo = true }
        };
        service.SaveDeviceSettings(firstCall);

        // Act
        var secondCall = service.GetOrCreateDeviceSettings(deviceId);

        // Assert
        secondCall.DeviceId.Should().Be(deviceId);
        secondCall.VideoSettings.EnableVideo.Should().BeTrue();
    }

    [Fact]
    public void GetOrCreateDeviceSettings_ShouldPersistNewDevice_Immediately()
    {
        // Arrange
        var service1 = new SettingsService(_mockLogger);
        var deviceId = "PERSIST_TEST_DEVICE";

        // Act
        service1.GetOrCreateDeviceSettings(deviceId);
        
        // Create new service instance to verify persistence
        var service2 = new SettingsService(_mockLogger);
        var retrieved = service2.GetDeviceSettings(deviceId);

        // Assert
        retrieved.Should().NotBeNull();
        retrieved!.DeviceId.Should().Be(deviceId);
    }

    [Fact]
    public void SaveDeviceSettings_ShouldUpdateExistingDevice()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var deviceId = "UPDATE_TEST_DEVICE";
        var original = service.GetOrCreateDeviceSettings(deviceId);
        
        var updated = original with
        {
            VideoSettings = original.VideoSettings with { EnableVideo = true },
            ConnectionSettings = original.ConnectionSettings with { AutoConnectEnabled = false }
        };

        // Act
        service.SaveDeviceSettings(updated);
        var retrieved = service.GetDeviceSettings(deviceId);

        // Assert
        retrieved.Should().NotBeNull();
        retrieved!.VideoSettings.EnableVideo.Should().BeTrue();
        retrieved.ConnectionSettings.AutoConnectEnabled.Should().BeFalse();
    }

    [Fact]
    public void SaveDeviceSettings_ShouldAddNewDevice_WhenNotExists()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var deviceId = "NEW_SAVE_DEVICE";
        var newDevice = new DeviceSettings
        {
            DeviceId = deviceId,
            VideoSettings = new VideoSettings { EnableVideo = true },
            ConnectionSettings = new ConnectionSettings 
            { 
                AutoConnectEnabled = false
            }
        };

        // Act
        service.SaveDeviceSettings(newDevice);
        var retrieved = service.GetDeviceSettings(deviceId);

        // Assert
        retrieved.Should().NotBeNull();
        retrieved!.DeviceId.Should().Be(deviceId);
        retrieved.VideoSettings.EnableVideo.Should().BeTrue();
    }

    [Fact]
    public void SaveDeviceSettings_ShouldPersistChanges_AcrossServiceInstances()
    {
        // Arrange
        var service1 = new SettingsService(_mockLogger);
        var deviceId = "PERSISTENCE_CHECK_DEVICE";
        var device = service1.GetOrCreateDeviceSettings(deviceId);
        device = device with
        {
            VideoSettings = device.VideoSettings with { EnableVideo = true, VideoDeviceId = "TestVideo123" }
        };

        // Act
        service1.SaveDeviceSettings(device);
        
        // Create new service to verify persistence
        var service2 = new SettingsService(_mockLogger);
        var retrieved = service2.GetDeviceSettings(deviceId);

        // Assert
        retrieved.Should().NotBeNull();
        retrieved!.VideoSettings.EnableVideo.Should().BeTrue();
        retrieved.VideoSettings.VideoDeviceId.Should().Be("TestVideo123");
    }

    [Fact]
    public async Task KnownDevices_Observable_ShouldEmitInitialValue()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        List<DeviceSettings>? received = null;

        // Act
        await service.KnownDevices
            .Take(1)
            .Do(s => received = s)
            .ToTask();

        // Assert
        received.Should().NotBeNull();
    }

    [Fact]
    public async Task KnownDevices_Observable_ShouldEmit_WhenDeviceAdded()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var emittedValues = new List<List<DeviceSettings>>();
        var subscription = service.KnownDevices.Subscribe(emittedValues.Add);
        var deviceId = "OBSERVABLE_TEST_DEVICE";

        // Act
        service.GetOrCreateDeviceSettings(deviceId);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        emittedValues.Should().HaveCountGreaterThanOrEqualTo(2); // Initial + added
        emittedValues.Last().Should().Contain(d => d.DeviceId == deviceId);
    }

    [Fact]
    public async Task KnownDevices_Observable_ShouldEmit_WhenDeviceUpdated()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var deviceId = "UPDATE_OBSERVABLE_DEVICE";
        var device = service.GetOrCreateDeviceSettings(deviceId);
        
        var emittedValues = new List<List<DeviceSettings>>();
        var subscription = service.KnownDevices.Subscribe(emittedValues.Add);
        
        var updated = device with
        {
            VideoSettings = device.VideoSettings with { EnableVideo = true }
        };

        // Act
        service.SaveDeviceSettings(updated);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        emittedValues.Should().HaveCountGreaterThanOrEqualTo(2);
        var lastEmission = emittedValues.Last();
        var emittedDevice = lastEmission.FirstOrDefault(d => d.DeviceId == deviceId);
        emittedDevice.Should().NotBeNull();
        emittedDevice!.VideoSettings.EnableVideo.Should().BeTrue();
    }

    [Fact]
    public async Task KnownDevices_Observable_ShouldNotEmit_WhenOtherSettingsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var deviceEmissions = new List<List<DeviceSettings>>();
        var subscription = service.KnownDevices.Subscribe(deviceEmissions.Add);

        var settings = service.GetSettings();
        
        // Modify only PlayerSettings (not KnownDevices)
        settings = settings with
        {
            PlayerSettings = settings.PlayerSettings with
            {
                RepeatModeOnStartup = !settings.PlayerSettings.RepeatModeOnStartup
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        deviceEmissions.Should().HaveCount(1, "KnownDevices observable should not emit when only PlayerSettings changes");
    }

    #endregion

    #region Provider Interface Tests - PlayerSettings

    [Fact]
    public void GetPlayerSettings_ShouldReturnPlayerSettings()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);

        // Act
        var playerSettings = service.GetPlayerSettings();

        // Assert
        playerSettings.Should().NotBeNull();
        playerSettings.Should().BeOfType<PlayerSettings>();
    }

    [Fact]
    public async Task PlayerSettings_Observable_ShouldEmitInitialValue()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        PlayerSettings? received = null;

        // Act
        await service.PlayerSettings
            .Take(1)
            .Do(s => received = s)
            .ToTask();

        // Assert
        received.Should().NotBeNull();
    }

    [Fact]
    public async Task PlayerSettings_Observable_ShouldEmit_WhenPlayerSettingsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var emittedValues = new List<PlayerSettings>();
        var subscription = service.PlayerSettings.Subscribe(emittedValues.Add);

        var settings = service.GetSettings();
        settings = settings with
        {
            PlayerSettings = settings.PlayerSettings with
            {
                RepeatModeOnStartup = !settings.PlayerSettings.RepeatModeOnStartup
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        emittedValues.Should().HaveCountGreaterThanOrEqualTo(2);
        emittedValues.Last().RepeatModeOnStartup.Should().Be(settings.PlayerSettings.RepeatModeOnStartup);
    }

    #endregion



    #region Provider Interface Tests - FileTransferSettings

    [Fact]
    public void GetFileTransferSettings_ShouldReturnFileTransferSettings()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);

        // Act
        var fileTransferSettings = service.GetFileTransferSettings();

        // Assert
        fileTransferSettings.Should().NotBeNull();
        fileTransferSettings.Should().BeOfType<FileTransferSettings>();
    }

    [Fact]
    public async Task FileTransferSettings_Observable_ShouldEmitInitialValue()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        FileTransferSettings? received = null;

        // Act
        await service.FileTransferSettings
            .Take(1)
            .Do(s => received = s)
            .ToTask();

        // Assert
        received.Should().NotBeNull();
    }

    [Fact]
    public async Task FileTransferSettings_Observable_ShouldEmit_WhenFileTransferSettingsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var emittedValues = new List<FileTransferSettings>();
        var subscription = service.FileTransferSettings.Subscribe(emittedValues.Add);

        var settings = service.GetSettings();
        settings = settings with
        {
            FileTransferSettings = settings.FileTransferSettings with
            {
                AutoFileCopyEnabled = !settings.FileTransferSettings.AutoFileCopyEnabled
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        emittedValues.Should().HaveCountGreaterThanOrEqualTo(2);
        emittedValues.Last().AutoFileCopyEnabled.Should().Be(settings.FileTransferSettings.AutoFileCopyEnabled);
    }

    #endregion

    #region Provider Interface Tests - SearchSettings

    [Fact]
    public void GetSearchSettings_ShouldReturnSearchSettings()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);

        // Act
        var searchSettings = service.GetSearchSettings();

        // Assert
        searchSettings.Should().NotBeNull();
        searchSettings.Should().BeOfType<SearchSettings>();
    }

    [Fact]
    public async Task SearchSettings_Observable_ShouldEmitInitialValue()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        SearchSettings? received = null;

        // Act
        await service.SearchSettings
            .Take(1)
            .Do(s => received = s)
            .ToTask();

        // Assert
        received.Should().NotBeNull();
    }

    [Fact]
    public async Task SearchSettings_Observable_ShouldEmit_WhenSearchSettingsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var emittedValues = new List<SearchSettings>();
        var subscription = service.SearchSettings.Subscribe(emittedValues.Add);

        var settings = service.GetSettings();
        var uniqueFile = $"test_file_{Guid.NewGuid()}.sid";
        var newBannedFiles = new List<string>(settings.SearchSettings.BannedFiles) { uniqueFile };
        
        settings = settings with
        {
            SearchSettings = settings.SearchSettings with
            {
                BannedFiles = newBannedFiles
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        emittedValues.Should().HaveCountGreaterThanOrEqualTo(2);
        emittedValues.Last().BannedFiles.Should().Contain(uniqueFile);
    }

    #endregion

    #region Provider Interface Tests - AppSettings

    [Fact]
    public void GetAppSettings_ShouldReturnAppSettings()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);

        // Act
        var appSettings = service.GetAppSettings();

        // Assert
        appSettings.Should().NotBeNull();
        appSettings.Should().BeOfType<AppSettings>();
    }

    [Fact]
    public async Task AppSettings_Observable_ShouldEmitInitialValue()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        AppSettings? received = null;

        // Act
        await service.AppSettings
            .Take(1)
            .Do(s => received = s)
            .ToTask();

        // Assert
        received.Should().NotBeNull();
    }

    [Fact]
    public async Task AppSettings_Observable_ShouldEmit_WhenAppSettingsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var emittedValues = new List<AppSettings>();
        var subscription = service.AppSettings.Subscribe(emittedValues.Add);

        var settings = service.GetSettings();
        settings = settings with
        {
            AppSettings = settings.AppSettings with
            {
                FirstTimeSetup = !settings.AppSettings.FirstTimeSetup
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        emittedValues.Should().HaveCountGreaterThanOrEqualTo(2);
        emittedValues.Last().FirstTimeSetup.Should().Be(settings.AppSettings.FirstTimeSetup);
    }

    #endregion

    #region Validation Tests

    [Fact]
    public void ValidateAndLogSettings_ShouldReturnTrue_WhenWatchDirectoryExists()
    {
        // Arrange - Create service with existing watch directory pre-configured
        if (File.Exists(_settingsFilePath))
        {
            File.Delete(_settingsFilePath);
        }
        
        // Pre-create settings with our test watch directory
        var initialSettings = new TeensySettings();
        initialSettings.FileTransferSettings.WatchDirectoryLocation = _testWatchDirectory;
        var json = System.Text.Json.JsonSerializer.Serialize(initialSettings, 
            TeensyRom.Core.Entities.Storage.LaunchableItemSerializer.Options);
        Directory.CreateDirectory(Path.GetDirectoryName(_settingsFilePath)!);
        File.WriteAllText(_settingsFilePath, json);
        
        var mockLoggerForTest = Substitute.For<ILoggingService>();
        var service = new SettingsService(mockLoggerForTest);
        var settings = service.GetSettings();

        // Act
        var result = service.ValidateAndLogSettings(settings);

        // Assert
        result.Should().BeTrue();
        // The service validates on initialization, so we clear and check only our explicit call
        mockLoggerForTest.ClearReceivedCalls();
        result = service.ValidateAndLogSettings(settings);
        result.Should().BeTrue();
        mockLoggerForTest.DidNotReceive().InternalError(Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public void ValidateAndLogSettings_ShouldReturnFalse_WhenWatchDirectoryDoesNotExist()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        _mockLogger.ClearReceivedCalls(); // Clear any calls from initialization
        
        var settings = service.GetSettings();
        settings.FileTransferSettings.WatchDirectoryLocation = Path.Combine(Path.GetTempPath(), "NonExistentDir_" + Guid.NewGuid());

        // Act
        var result = service.ValidateAndLogSettings(settings);

        // Assert
        result.Should().BeFalse();
        _mockLogger.Received(1).InternalError(
            Arg.Is<string>(s => s.Contains("watch directory") && s.Contains("not found")),
            Arg.Any<string>());
    }

    [Fact]
    public void ValidateAndLogSettings_ShouldLogAppropriateMessage_ForMissingDirectory()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        _mockLogger.ClearReceivedCalls(); // Clear any calls from initialization
        
        var settings = service.GetSettings();
        var missingPath = Path.Combine(Path.GetTempPath(), "MissingDirectory_" + Guid.NewGuid());
        settings.FileTransferSettings.WatchDirectoryLocation = missingPath;

        // Act
        service.ValidateAndLogSettings(settings);

        // Assert
        _mockLogger.Received(1).InternalError(
            Arg.Is<string>(s => s.Contains(missingPath)),
            Arg.Any<string>());
    }

    #endregion

    #region File I/O and Serialization Tests

    [Fact]
    public void SaveSettings_ShouldSerializeToJson_WithCorrectFormat()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var settings = service.GetSettings();
        settings = settings with
        {
            AppSettings = settings.AppSettings with
            {
                FirstTimeSetup = true
            }
        };

        // Act
        service.SaveSettings(settings);

        // Assert
        var fileContent = File.ReadAllText(_settingsFilePath);
        fileContent.Should().Contain("\"firstTimeSetup\""); // camelCase
        fileContent.Should().Contain("true");
        fileContent.Should().Contain("appSettings");
    }

    [Fact]
    public void Settings_ShouldHandleCorruptedJsonFile_ByThrowingException()
    {
        // Arrange
        Directory.CreateDirectory(Path.GetDirectoryName(_settingsFilePath)!);
        File.WriteAllText(_settingsFilePath, "{ invalid json content }");

        // Act & Assert - The service will throw on deserialization
        // This is the expected behavior - corrupted files cause exceptions
        var act = () => new SettingsService(_mockLogger);
        act.Should().Throw<System.Text.Json.JsonException>();
    }

    [Fact]
    public void Settings_ShouldHandleEmptyJsonFile_ByThrowingException()
    {
        // Arrange
        Directory.CreateDirectory(Path.GetDirectoryName(_settingsFilePath)!);
        File.WriteAllText(_settingsFilePath, "");

        // Act & Assert - The service will throw on deserialization
        // This is the expected behavior - empty files cause exceptions
        var act = () => new SettingsService(_mockLogger);
        act.Should().Throw<System.Text.Json.JsonException>();
    }

    [Fact]
    public void Settings_ShouldPreserveComplexObjects_ThroughSerialization()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var originalSettings = service.GetSettings();
        originalSettings.SearchSettings.BannedDirectories = new List<string> { "Dir1", "Dir2", "Dir3" };
        originalSettings.SearchSettings.BannedFiles = new List<string> { "File1.sid", "File2.sid" };
        originalSettings.SearchSettings.SearchStopWords = new List<string> { "the", "a", "an" };

        // Act
        service.SaveSettings(originalSettings);
        var newService = new SettingsService(_mockLogger);
        var loadedSettings = newService.GetSettings();

        // Assert
        loadedSettings.SearchSettings.BannedDirectories.Should().BeEquivalentTo(originalSettings.SearchSettings.BannedDirectories);
        loadedSettings.SearchSettings.BannedFiles.Should().BeEquivalentTo(originalSettings.SearchSettings.BannedFiles);
        loadedSettings.SearchSettings.SearchStopWords.Should().BeEquivalentTo(originalSettings.SearchSettings.SearchStopWords);
    }

    #endregion

    #region DeviceSettings IndexingStatus Tests

    [Fact]
    public void DeviceSettings_ShouldInitializeWithNullTimestamps()
    {
        // Arrange & Act
        var deviceSettings = new DeviceSettings();

        // Assert
        deviceSettings.IndexingStatus.Should().NotBeNull();
        deviceSettings.IndexingStatus.SdLastIndexed.Should().BeNull();
        deviceSettings.IndexingStatus.UsbLastIndexed.Should().BeNull();
    }

    [Fact]
    public void DeviceSettings_ShouldSerializeIndexingStatusWithTimestamps()
    {
        // Arrange
        var sdTime = DateTime.UtcNow.AddHours(-2);
        var usbTime = DateTime.UtcNow.AddHours(-1);
        var deviceSettings = new DeviceSettings
        {
            DeviceId = "test-device",
            IndexingStatus = new IndexingStatus
            {
                SdLastIndexed = sdTime,
                UsbLastIndexed = usbTime
            }
        };

        // Act
        var json = System.Text.Json.JsonSerializer.Serialize(deviceSettings,
            TeensyRom.Core.Entities.Storage.LaunchableItemSerializer.Options);
        var deserialized = System.Text.Json.JsonSerializer.Deserialize<DeviceSettings>(json,
            TeensyRom.Core.Entities.Storage.LaunchableItemSerializer.Options);

        // Assert
        deserialized.Should().NotBeNull();
        deserialized!.IndexingStatus.Should().NotBeNull();
        deserialized.IndexingStatus.SdLastIndexed.Should().BeCloseTo(sdTime, TimeSpan.FromMilliseconds(1));
        deserialized.IndexingStatus.UsbLastIndexed.Should().BeCloseTo(usbTime, TimeSpan.FromMilliseconds(1));
    }

    [Fact]
    public void DeviceSettings_ShouldSerializeIndexingStatusWithNullTimestamps()
    {
        // Arrange
        var deviceSettings = new DeviceSettings
        {
            DeviceId = "test-device",
            IndexingStatus = new IndexingStatus
            {
                SdLastIndexed = null,
                UsbLastIndexed = null
            }
        };

        // Act
        var json = System.Text.Json.JsonSerializer.Serialize(deviceSettings,
            TeensyRom.Core.Entities.Storage.LaunchableItemSerializer.Options);
        var deserialized = System.Text.Json.JsonSerializer.Deserialize<DeviceSettings>(json,
            TeensyRom.Core.Entities.Storage.LaunchableItemSerializer.Options);

        // Assert
        deserialized.Should().NotBeNull();
        deserialized!.IndexingStatus.Should().NotBeNull();
        deserialized.IndexingStatus.SdLastIndexed.Should().BeNull();
        deserialized.IndexingStatus.UsbLastIndexed.Should().BeNull();
    }

    [Fact]
    public void DeviceSettings_ShouldSerializeIndexingStatusWithMixedTimestamps()
    {
        // Arrange
        var sdTime = DateTime.UtcNow;
        var deviceSettings = new DeviceSettings
        {
            DeviceId = "test-device",
            IndexingStatus = new IndexingStatus
            {
                SdLastIndexed = sdTime,
                UsbLastIndexed = null
            }
        };

        // Act
        var json = System.Text.Json.JsonSerializer.Serialize(deviceSettings,
            TeensyRom.Core.Entities.Storage.LaunchableItemSerializer.Options);
        var deserialized = System.Text.Json.JsonSerializer.Deserialize<DeviceSettings>(json,
            TeensyRom.Core.Entities.Storage.LaunchableItemSerializer.Options);

        // Assert
        deserialized.Should().NotBeNull();
        deserialized!.IndexingStatus.Should().NotBeNull();
        deserialized.IndexingStatus.SdLastIndexed.Should().BeCloseTo(sdTime, TimeSpan.FromMilliseconds(1));
        deserialized.IndexingStatus.UsbLastIndexed.Should().BeNull();
    }

    [Fact]
    public void DeviceSettings_ShouldDeserializeOldJsonWithoutIndexingStatus()
    {
        // Arrange - JSON from old format without IndexingStatus
        var oldJson = @"{
            ""deviceId"": ""old-device"",
            ""videoSettings"": {
                ""enableVideo"": false,
                ""videoDeviceId"": """"
            },
            ""connectionSettings"": {
                ""autoConnectEnabled"": true
            }
        }";

        // Act
        var deserialized = System.Text.Json.JsonSerializer.Deserialize<DeviceSettings>(oldJson,
            TeensyRom.Core.Entities.Storage.LaunchableItemSerializer.Options);

        // Assert - Should deserialize with default IndexingStatus
        deserialized.Should().NotBeNull();
        deserialized!.DeviceId.Should().Be("old-device");
        deserialized.IndexingStatus.Should().NotBeNull();
        deserialized.IndexingStatus.SdLastIndexed.Should().BeNull();
        deserialized.IndexingStatus.UsbLastIndexed.Should().BeNull();
    }

    [Fact]
    public void DeviceSettings_ShouldRoundTripSerializeCompleteSettings()
    {
        // Arrange
        var sdTime = DateTime.UtcNow.AddDays(-1);
        var usbTime = DateTime.UtcNow.AddHours(-3);
        var original = new DeviceSettings
        {
            DeviceId = "round-trip-test",
            VideoSettings = new VideoSettings
            {
                EnableVideo = true,
                VideoDeviceId = "video123"
            },
            ConnectionSettings = new ConnectionSettings
            {
                AutoConnectEnabled = false
            },
            IndexingStatus = new IndexingStatus
            {
                SdLastIndexed = sdTime,
                UsbLastIndexed = usbTime
            }
        };

        // Act - Serialize and deserialize
        var json = System.Text.Json.JsonSerializer.Serialize(original,
            TeensyRom.Core.Entities.Storage.LaunchableItemSerializer.Options);
        var deserialized = System.Text.Json.JsonSerializer.Deserialize<DeviceSettings>(json,
            TeensyRom.Core.Entities.Storage.LaunchableItemSerializer.Options);

        // Assert - All properties should match
        deserialized.Should().NotBeNull();
        deserialized!.DeviceId.Should().Be(original.DeviceId);
        deserialized.VideoSettings.EnableVideo.Should().Be(original.VideoSettings.EnableVideo);
        deserialized.VideoSettings.VideoDeviceId.Should().Be(original.VideoSettings.VideoDeviceId);
        deserialized.ConnectionSettings.AutoConnectEnabled.Should().Be(original.ConnectionSettings.AutoConnectEnabled);
        deserialized.IndexingStatus.SdLastIndexed.Should().BeCloseTo(sdTime, TimeSpan.FromMilliseconds(1));
        deserialized.IndexingStatus.UsbLastIndexed.Should().BeCloseTo(usbTime, TimeSpan.FromMilliseconds(1));
    }

    #endregion

    #region Utility Method Tests

    [Fact]
    public void GetFileNameSafeHash_ShouldReturnConsistentHash_ForSameInput()
    {
        // Arrange
        var input = "TestString123";

        // Act
        var hash1 = SettingsService.GetFileNameSafeHash(input);
        var hash2 = SettingsService.GetFileNameSafeHash(input);

        // Assert
        hash1.Should().Be(hash2);
    }

    [Fact]
    public void GetFileNameSafeHash_ShouldReturnDifferentHash_ForDifferentInput()
    {
        // Arrange
        var input1 = "TestString1";
        var input2 = "TestString2";

        // Act
        var hash1 = SettingsService.GetFileNameSafeHash(input1);
        var hash2 = SettingsService.GetFileNameSafeHash(input2);

        // Assert
        hash1.Should().NotBe(hash2);
    }

    [Fact]
    public void GetFileNameSafeHash_ShouldReturnValidHexString()
    {
        // Arrange
        var input = "TestString";

        // Act
        var hash = SettingsService.GetFileNameSafeHash(input);

        // Assert
        hash.Should().NotBeNullOrWhiteSpace();
        hash.Should().MatchRegex("^[0-9A-F]+$"); // Valid hex string
        hash.Length.Should().Be(32); // MD5 hash length in hex
    }

    [Fact]
    public void GetFileNameSafeHash_ShouldHandleEmptyString()
    {
        // Arrange
        var input = string.Empty;

        // Act
        var hash = SettingsService.GetFileNameSafeHash(input);

        // Assert
        hash.Should().NotBeNullOrWhiteSpace();
        hash.Length.Should().Be(32);
    }

    [Fact]
    public void GetFileNameSafeHash_ShouldHandleUnicodeCharacters()
    {
        // Arrange
        var input = "Test™∞§¶•ªº–≠";

        // Act
        var hash = SettingsService.GetFileNameSafeHash(input);

        // Assert
        hash.Should().NotBeNullOrWhiteSpace();
        hash.Should().MatchRegex("^[0-9A-F]+$");
    }

    #endregion

    #region Settings Type-Specific Tests

    [Fact]
    public void PlayerSettings_ShouldHaveValidDefaults()
    {
        // Arrange & Act
        var service = new SettingsService(_mockLogger);
        var playerSettings = service.GetPlayerSettings();

        // Assert
        playerSettings.RepeatModeOnStartup.Should().BeFalse();
        playerSettings.PlayTimerEnabled.Should().BeFalse();
        playerSettings.MuteFastForward.Should().BeFalse();
        playerSettings.MuteRandomSeek.Should().BeFalse();
        playerSettings.StartupLaunchEnabled.Should().BeTrue();
        playerSettings.StartupLaunchRandom.Should().BeFalse();
    }

    [Fact]
    public void FileTransferSettings_ShouldHaveValidDefaults()
    {
        // Arrange & Act
        var service = new SettingsService(_mockLogger);
        var fileTransferSettings = service.GetFileTransferSettings();

        // Assert
        fileTransferSettings.WatchDirectoryLocation.Should().NotBeNullOrEmpty();
        fileTransferSettings.AutoTransferPath.Should().NotBeNull();
        fileTransferSettings.AutoFileCopyEnabled.Should().BeFalse();
        fileTransferSettings.AutoLaunchOnCopyEnabled.Should().BeTrue();
        fileTransferSettings.NavToDirOnLaunch.Should().BeTrue();
        fileTransferSettings.SyncFilesEnabled.Should().BeFalse();
    }

    [Fact]
    public void SearchSettings_ShouldHaveValidDefaults()
    {
        // Arrange & Act
        var service = new SettingsService(_mockLogger);
        var searchSettings = service.GetSearchSettings();

        // Assert
        searchSettings.SearchWeights.Should().NotBeNull();
        searchSettings.SearchStopWords.Should().NotBeEmpty();
        searchSettings.BannedDirectories.Should().NotBeEmpty();
        searchSettings.BannedFiles.Should().NotBeEmpty();
    }

    [Fact]
    public void AppSettings_ShouldHaveValidDefaults()
    {
        // Arrange & Act
        var service = new SettingsService(_mockLogger);
        var appSettings = service.GetAppSettings();

        // Assert
        appSettings.FirstTimeSetup.Should().BeTrue();
    }

    #endregion

    #region Integration Tests

    [Fact]
    public void Settings_ShouldPersist_AcrossServiceInstances()
    {
        // Arrange
        var service1 = new SettingsService(_mockLogger);
        var settings = service1.GetSettings();
        settings = settings with
        {
            PlayerSettings = settings.PlayerSettings with
            {
                MuteFastForward = true,
                MuteRandomSeek = true
            }
        };
        service1.SaveSettings(settings);

        // Act
        var service2 = new SettingsService(_mockLogger);
        var loadedSettings = service2.GetSettings();

        // Assert
        loadedSettings.PlayerSettings.MuteFastForward.Should().BeTrue();
        loadedSettings.PlayerSettings.MuteRandomSeek.Should().BeTrue();
    }

    [Fact]
    public async Task MultipleProviders_ShouldReceiveUpdates_Independently()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var deviceEmissions = new List<List<DeviceSettings>>();
        var playerEmissions = new List<PlayerSettings>();
        
        var deviceSub = service.KnownDevices.Subscribe(deviceEmissions.Add);
        var playerSub = service.PlayerSettings.Subscribe(playerEmissions.Add);

        var deviceId = "MULTI_PROVIDER_TEST_DEVICE";
        service.GetOrCreateDeviceSettings(deviceId);
        await Task.Delay(100);
        
        var settings = service.GetSettings();
        settings = settings with
        {
            PlayerSettings = settings.PlayerSettings with
            {
                RepeatModeOnStartup = !settings.PlayerSettings.RepeatModeOnStartup
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        deviceSub.Dispose();
        playerSub.Dispose();

        deviceEmissions.Should().HaveCountGreaterThanOrEqualTo(2);
        playerEmissions.Should().HaveCountGreaterThanOrEqualTo(2);
        deviceEmissions.Last().Should().Contain(d => d.DeviceId == deviceId);
        playerEmissions.Last().RepeatModeOnStartup.Should().Be(settings.PlayerSettings.RepeatModeOnStartup);
    }

    #endregion

    #region Observable Isolation Tests - DistinctUntilChanged Verification

    [Fact]
    public async Task PlayerSettings_Observable_ShouldNotEmit_WhenOtherSectionsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var playerEmissions = new List<PlayerSettings>();
        var subscription = service.PlayerSettings.Subscribe(playerEmissions.Add);

        var settings = service.GetSettings();
        
        // Modify only AppSettings (not PlayerSettings)
        settings = settings with
        {
            AppSettings = settings.AppSettings with
            {
                FirstTimeSetup = !settings.AppSettings.FirstTimeSetup
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        playerEmissions.Should().HaveCount(1, "PlayerSettings observable should not emit when only AppSettings changes");
    }

    [Fact]
    public async Task FileTransferSettings_Observable_ShouldNotEmit_WhenOtherSectionsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var fileTransferEmissions = new List<FileTransferSettings>();
        var subscription = service.FileTransferSettings.Subscribe(fileTransferEmissions.Add);

        var settings = service.GetSettings();
        
        // Modify only SearchSettings (not FileTransferSettings)
        settings = settings with
        {
            SearchSettings = settings.SearchSettings with
            {
                BannedFiles = new List<string> { "new-banned-file.sid" }
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        fileTransferEmissions.Should().HaveCount(1, "FileTransferSettings observable should not emit when only SearchSettings changes");
    }

    [Fact]
    public async Task SearchSettings_Observable_ShouldNotEmit_WhenOtherSectionsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var searchEmissions = new List<SearchSettings>();
        var subscription = service.SearchSettings.Subscribe(searchEmissions.Add);

        var settings = service.GetSettings();
        
        // Modify only AppSettings (not SearchSettings)
        settings = settings with
        {
            AppSettings = settings.AppSettings with
            {
                FirstTimeSetup = !settings.AppSettings.FirstTimeSetup
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        searchEmissions.Should().HaveCount(1, "SearchSettings observable should not emit when only AppSettings changes");
    }

    [Fact]
    public async Task AppSettings_Observable_ShouldNotEmit_WhenOtherSectionsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var appEmissions = new List<AppSettings>();
        var subscription = service.AppSettings.Subscribe(appEmissions.Add);

        var settings = service.GetSettings();
        
        // Modify only FileTransferSettings (not AppSettings)
        settings = settings with
        {
            FileTransferSettings = settings.FileTransferSettings with
            {
                AutoFileCopyEnabled = !settings.FileTransferSettings.AutoFileCopyEnabled
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        appEmissions.Should().HaveCount(1, "AppSettings observable should not emit when only FileTransferSettings changes");
    }

    [Fact]
    public async Task AllSectionObservables_ShouldOnlyEmit_ForTheirSpecificChanges()
    {
        // Arrange - Subscribe to all section observables
        var service = new SettingsService(_mockLogger);
        
        var knownDevicesEmissions = new List<List<DeviceSettings>>();
        var playerEmissions = new List<PlayerSettings>();
        var fileTransferEmissions = new List<FileTransferSettings>();
        var searchEmissions = new List<SearchSettings>();
        var appEmissions = new List<AppSettings>();
        
        var devicesSub = service.KnownDevices.Subscribe(knownDevicesEmissions.Add);
        var playerSub = service.PlayerSettings.Subscribe(playerEmissions.Add);
        var fileSub = service.FileTransferSettings.Subscribe(fileTransferEmissions.Add);
        var searchSub = service.SearchSettings.Subscribe(searchEmissions.Add);
        var appSub = service.AppSettings.Subscribe(appEmissions.Add);

        // Act 1 - Modify only KnownDevices (add a device)
        var deviceId = "TEST_DEVICE_SECTION_OBSERVABLE";
        service.GetOrCreateDeviceSettings(deviceId);
        await Task.Delay(100);

        // Assert 1 - Only KnownDevices should emit
        knownDevicesEmissions.Should().HaveCount(2, "KnownDevices changed");
        playerEmissions.Should().HaveCount(1, "PlayerSettings didn't change");
        fileTransferEmissions.Should().HaveCount(1, "FileTransferSettings didn't change");
        searchEmissions.Should().HaveCount(1, "SearchSettings didn't change");
        appEmissions.Should().HaveCount(1, "AppSettings didn't change");

        // Act 2 - Modify only PlayerSettings
        var settings = service.GetSettings();
        settings = settings with
        {
            PlayerSettings = settings.PlayerSettings with
            {
                PlayTimerEnabled = !settings.PlayerSettings.PlayTimerEnabled
            }
        };
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert 2 - Only PlayerSettings should emit (KnownDevices stays at 2)
        knownDevicesEmissions.Should().HaveCount(2, "KnownDevices didn't change in second save");
        playerEmissions.Should().HaveCount(2, "PlayerSettings changed");
        fileTransferEmissions.Should().HaveCount(1, "FileTransferSettings didn't change");
        searchEmissions.Should().HaveCount(1, "SearchSettings didn't change");
        appEmissions.Should().HaveCount(1, "AppSettings didn't change");

        // Cleanup
        devicesSub.Dispose();
        playerSub.Dispose();
        fileSub.Dispose();
        searchSub.Dispose();
        appSub.Dispose();
    }

    [Fact]
    public async Task SectionObservables_ShouldUseValueEquality_NotReferenceEquality()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var knownDevicesEmissions = new List<List<DeviceSettings>>();
        var subscription = service.KnownDevices.Subscribe(knownDevicesEmissions.Add);

        var settings = service.GetSettings();
        
        // Create a new KnownDevices list with the same values (value equality, different reference)
        var newDevicesList = settings.KnownDevices.Select(d => d with { }).ToList();
        settings = settings with
        {
            KnownDevices = newDevicesList
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        // Should not emit because values are the same (record value equality)
        knownDevicesEmissions.Should().HaveCount(1, "DistinctUntilChanged uses value equality for records");
    }

    #endregion
}
