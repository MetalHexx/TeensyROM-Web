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
        // INTENTIONALLY BROKEN: Changed NotBeEmpty to BeEmpty to cause test failure
        settings.SearchSettings.BannedDirectories.Should().BeEmpty("INTENTIONALLY BROKEN - validating backend workflow");
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
        deviceSettings.StorageType.Should().Be(StorageType.SD);
        deviceSettings.AutoLaunchEnabled.Should().BeFalse();
    }

    [Fact]
    public void GetOrCreateDeviceSettings_ShouldReturnExistingDevice_WhenAlreadyExists()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var deviceId = "EXISTING_DEVICE_789";
        
        // Create device with specific values
        var created = service.GetOrCreateDeviceSettings(deviceId);
        var modifiedSettings = service.GetSettings();
        var existingDevice = modifiedSettings.KnownDevices.First(d => d.DeviceId == deviceId);
        var updatedDevice = existingDevice with { StorageType = StorageType.Usb };
        modifiedSettings = modifiedSettings with
        {
            KnownDevices = modifiedSettings.KnownDevices
                .Where(d => d.DeviceId != deviceId)
                .Append(updatedDevice)
                .ToList()
        };
        service.SaveSettings(modifiedSettings);

        // Act
        var retrieved = service.GetOrCreateDeviceSettings(deviceId);

        // Assert
        retrieved.StorageType.Should().Be(StorageType.Usb);
    }

    [Fact]
    public void UpdateDeviceSettings_ShouldPersistChanges()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var deviceId = "UPDATE_DEVICE_101";
        var created = service.GetOrCreateDeviceSettings(deviceId);
        
        var updated = created with
        {
            StorageType = StorageType.Usb,
            AutoLaunchEnabled = true,
            LastDirectoryPath = "/test/path"
        };

        // Act
        service.UpdateDeviceSettings(updated);

        // Assert
        var retrieved = service.GetDeviceSettings(deviceId);
        retrieved.Should().NotBeNull();
        retrieved!.StorageType.Should().Be(StorageType.Usb);
        retrieved.AutoLaunchEnabled.Should().BeTrue();
        retrieved.LastDirectoryPath.Should().Be("/test/path");
    }

    [Fact]
    public void UpdateDeviceSettings_ShouldAddNewDevice_WhenNotExists()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var newDevice = new DeviceSettings
        {
            DeviceId = "BRAND_NEW_DEVICE",
            StorageType = StorageType.Usb,
            AutoLaunchEnabled = true
        };

        // Act
        service.UpdateDeviceSettings(newDevice);

        // Assert
        var retrieved = service.GetDeviceSettings(newDevice.DeviceId);
        retrieved.Should().NotBeNull();
        retrieved!.DeviceId.Should().Be(newDevice.DeviceId);
        retrieved.StorageType.Should().Be(StorageType.Usb);
    }

    #endregion

    #region Error Handling Tests

    [Fact]
    public void Constructor_ShouldHandleCorruptedSettingsFile_Gracefully()
    {
        // Arrange - Create a corrupted settings file
        var settingsDir = Path.GetDirectoryName(_settingsFilePath)!;
        Directory.CreateDirectory(settingsDir);
        File.WriteAllText(_settingsFilePath, "{ invalid json content");

        // Act
        var service = new SettingsService(_mockLogger);
        var settings = service.GetSettings();

        // Assert
        settings.Should().NotBeNull();
        // Service should log an error and use defaults
        _mockLogger.Received().LogError(Arg.Any<string>());
    }

    [Fact]
    public void Constructor_ShouldHandleEmptySettingsFile_Gracefully()
    {
        // Arrange - Create an empty settings file
        var settingsDir = Path.GetDirectoryName(_settingsFilePath)!;
        Directory.CreateDirectory(settingsDir);
        File.WriteAllText(_settingsFilePath, "");

        // Act
        var service = new SettingsService(_mockLogger);
        var settings = service.GetSettings();

        // Assert
        settings.Should().NotBeNull();
    }

    #endregion
}
