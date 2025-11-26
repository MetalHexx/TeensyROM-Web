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
        settings.ConnectionSettings.Should().NotBeNull();
        settings.ConnectionSettings.AutoConnectEnabled.Should().BeTrue();
        settings.PlayerSettings.Should().NotBeNull();
        settings.VideoSettings.Should().NotBeNull();
        settings.VideoSettings.EnableVideo.Should().BeFalse();
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
        var originalAutoConnect = originalSettings.ConnectionSettings.AutoConnectEnabled;

        // Act - Attempt to modify through the API (but GetSettings returns a new copy each time)
        var copiedSettings = service.GetSettings();
        
        // Modify using proper record syntax to create a new instance
        var modifiedSettings = copiedSettings with
        {
            ConnectionSettings = copiedSettings.ConnectionSettings with
            {
                AutoConnectEnabled = !originalAutoConnect
            }
        };
        
        // We're not saving this, just verifying the original cached value is unchanged
        
        // Assert - Original cached value should not be affected since we didn't save
        var refreshedSettings = service.GetSettings();
        refreshedSettings.ConnectionSettings.AutoConnectEnabled.Should().Be(originalAutoConnect);
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
            ConnectionSettings = new ConnectionSettings 
            { 
                ConnectionType = ConnectionType.Tcp,
                AutoConnectEnabled = false
            },
            PlayerSettings = new PlayerSettings 
            { 
                RepeatModeOnStartup = true,
                PlayTimerEnabled = true
            },
            VideoSettings = new VideoSettings
            {
                EnableVideo = true
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
        actualSettings.ConnectionSettings.ConnectionType.Should().Be(expectedSettings.ConnectionSettings.ConnectionType);
        actualSettings.ConnectionSettings.AutoConnectEnabled.Should().Be(expectedSettings.ConnectionSettings.AutoConnectEnabled);
        actualSettings.PlayerSettings.RepeatModeOnStartup.Should().Be(expectedSettings.PlayerSettings.RepeatModeOnStartup);
        actualSettings.VideoSettings.EnableVideo.Should().Be(expectedSettings.VideoSettings.EnableVideo);
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
            ConnectionSettings = newSettings.ConnectionSettings with
            {
                ConnectionType = ConnectionType.Tcp
            }
        };

        // Act
        var result = service.SaveSettings(newSettings);

        // Assert
        result.Should().BeTrue();
        File.Exists(_settingsFilePath).Should().BeTrue();
        
        // Verify by reading the file directly
        var fileContent = File.ReadAllText(_settingsFilePath);
        fileContent.Should().Contain("\"connectionType\"");
        fileContent.Should().Contain("1"); // Tcp enum value
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
            ConnectionSettings = newSettings.ConnectionSettings with
            {
                ConnectionType = ConnectionType.Tcp
            }
        };

        // Act
        service.SaveSettings(newSettings);
        await Task.Delay(100); // Allow observable to emit

        // Assert
        subscription.Dispose();
        emittedSettings.Should().HaveCountGreaterThanOrEqualTo(2); // Initial + updated
        emittedSettings.Last().ConnectionSettings.ConnectionType.Should().Be(ConnectionType.Tcp);
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

    #region Provider Interface Tests - ConnectionSettings

    [Fact]
    public void GetConnectionSettings_ShouldReturnConnectionSettings()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);

        // Act
        var connectionSettings = service.GetConnectionSettings();

        // Assert
        connectionSettings.Should().NotBeNull();
        connectionSettings.Should().BeOfType<ConnectionSettings>();
    }

    [Fact]
    public async Task ConnectionSettings_Observable_ShouldEmitInitialValue()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        ConnectionSettings? received = null;

        // Act
        await service.ConnectionSettings
            .Take(1)
            .Do(s => received = s)
            .ToTask();

        // Assert
        received.Should().NotBeNull();
    }

    [Fact]
    public async Task ConnectionSettings_Observable_ShouldEmit_WhenConnectionSettingsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var emittedValues = new List<ConnectionSettings>();
        var subscription = service.ConnectionSettings.Subscribe(emittedValues.Add);

        var settings = service.GetSettings();
        var newConnectionType = settings.ConnectionSettings.ConnectionType == ConnectionType.Serial 
            ? ConnectionType.Tcp 
            : ConnectionType.Serial;
        
        // Create a new settings object with a new ConnectionSettings instance
        settings = settings with
        {
            ConnectionSettings = settings.ConnectionSettings with
            {
                ConnectionType = newConnectionType
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        emittedValues.Should().HaveCountGreaterThanOrEqualTo(2); // Initial + changed
        emittedValues.Last().ConnectionType.Should().Be(newConnectionType);
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

    #region Provider Interface Tests - VideoSettings

    [Fact]
    public void GetVideoSettings_ShouldReturnVideoSettings()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);

        // Act
        var videoSettings = service.GetVideoSettings();

        // Assert
        videoSettings.Should().NotBeNull();
        videoSettings.Should().BeOfType<VideoSettings>();
    }

    [Fact]
    public async Task VideoSettings_Observable_ShouldEmitInitialValue()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        VideoSettings? received = null;

        // Act
        await service.VideoSettings
            .Take(1)
            .Do(s => received = s)
            .ToTask();

        // Assert
        received.Should().NotBeNull();
    }

    [Fact]
    public async Task VideoSettings_Observable_ShouldEmit_WhenVideoSettingsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var emittedValues = new List<VideoSettings>();
        var subscription = service.VideoSettings.Subscribe(emittedValues.Add);

        var settings = service.GetSettings();
        settings = settings with
        {
            VideoSettings = settings.VideoSettings with
            {
                EnableVideo = !settings.VideoSettings.EnableVideo
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        emittedValues.Should().HaveCountGreaterThanOrEqualTo(2);
        emittedValues.Last().EnableVideo.Should().Be(settings.VideoSettings.EnableVideo);
    }

    [Fact]
    public async Task VideoSettings_Observable_ShouldNotEmit_WhenOtherSectionsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var videoEmissions = new List<VideoSettings>();
        var subscription = service.VideoSettings.Subscribe(videoEmissions.Add);

        var settings = service.GetSettings();
        
        // Modify only PlayerSettings (not VideoSettings)
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
        videoEmissions.Should().HaveCount(1, "VideoSettings observable should not emit when only PlayerSettings changes");
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
            ConnectionSettings = settings.ConnectionSettings with
            {
                AutoConnectEnabled = true
            }
        };

        // Act
        service.SaveSettings(settings);

        // Assert
        var fileContent = File.ReadAllText(_settingsFilePath);
        fileContent.Should().Contain("\"autoConnectEnabled\""); // camelCase
        fileContent.Should().Contain("true");
        fileContent.Should().Contain("connectionSettings");
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
    public void ConnectionSettings_ShouldHaveValidDefaults()
    {
        // Arrange & Act
        var service = new SettingsService(_mockLogger);
        var connectionSettings = service.GetConnectionSettings();

        // Assert
        connectionSettings.ConnectionType.Should().Be(ConnectionType.Serial);
        connectionSettings.AutoConnectEnabled.Should().BeTrue();
    }

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
    public void VideoSettings_ShouldHaveValidDefaults()
    {
        // Arrange & Act
        var service = new SettingsService(_mockLogger);
        var videoSettings = service.GetVideoSettings();

        // Assert
        videoSettings.EnableVideo.Should().BeFalse();
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
        var connectionEmissions = new List<ConnectionSettings>();
        var playerEmissions = new List<PlayerSettings>();
        
        var connSub = service.ConnectionSettings.Subscribe(connectionEmissions.Add);
        var playerSub = service.PlayerSettings.Subscribe(playerEmissions.Add);

        var settings = service.GetSettings();
        settings = settings with
        {
            ConnectionSettings = settings.ConnectionSettings with
            {
                AutoConnectEnabled = !settings.ConnectionSettings.AutoConnectEnabled
            },
            PlayerSettings = settings.PlayerSettings with
            {
                RepeatModeOnStartup = !settings.PlayerSettings.RepeatModeOnStartup
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        connSub.Dispose();
        playerSub.Dispose();

        connectionEmissions.Should().HaveCountGreaterThanOrEqualTo(2);
        playerEmissions.Should().HaveCountGreaterThanOrEqualTo(2);
        connectionEmissions.Last().AutoConnectEnabled.Should().Be(settings.ConnectionSettings.AutoConnectEnabled);
        playerEmissions.Last().RepeatModeOnStartup.Should().Be(settings.PlayerSettings.RepeatModeOnStartup);
    }

    #endregion

    #region Observable Isolation Tests - DistinctUntilChanged Verification

    [Fact]
    public async Task ConnectionSettings_Observable_ShouldNotEmit_WhenOtherSectionsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var connectionEmissions = new List<ConnectionSettings>();
        var subscription = service.ConnectionSettings.Subscribe(connectionEmissions.Add);

        var settings = service.GetSettings();
        
        // Modify only PlayerSettings (not ConnectionSettings)
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
        // Should only have initial emission, no new emission since ConnectionSettings didn't change
        connectionEmissions.Should().HaveCount(1, "ConnectionSettings observable should not emit when only PlayerSettings changes");
    }

    [Fact]
    public async Task PlayerSettings_Observable_ShouldNotEmit_WhenOtherSectionsChange()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var playerEmissions = new List<PlayerSettings>();
        var subscription = service.PlayerSettings.Subscribe(playerEmissions.Add);

        var settings = service.GetSettings();
        
        // Modify only ConnectionSettings (not PlayerSettings)
        settings = settings with
        {
            ConnectionSettings = settings.ConnectionSettings with
            {
                ConnectionType = settings.ConnectionSettings.ConnectionType == ConnectionType.Serial 
                    ? ConnectionType.Tcp 
                    : ConnectionType.Serial
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        playerEmissions.Should().HaveCount(1, "PlayerSettings observable should not emit when only ConnectionSettings changes");
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
        
        var connectionEmissions = new List<ConnectionSettings>();
        var playerEmissions = new List<PlayerSettings>();
        var fileTransferEmissions = new List<FileTransferSettings>();
        var searchEmissions = new List<SearchSettings>();
        var appEmissions = new List<AppSettings>();
        
        var connSub = service.ConnectionSettings.Subscribe(connectionEmissions.Add);
        var playerSub = service.PlayerSettings.Subscribe(playerEmissions.Add);
        var fileSub = service.FileTransferSettings.Subscribe(fileTransferEmissions.Add);
        var searchSub = service.SearchSettings.Subscribe(searchEmissions.Add);
        var appSub = service.AppSettings.Subscribe(appEmissions.Add);

        // Act 1 - Modify only ConnectionSettings
        var settings = service.GetSettings();
        settings = settings with
        {
            ConnectionSettings = settings.ConnectionSettings with
            {
                AutoConnectEnabled = !settings.ConnectionSettings.AutoConnectEnabled
            }
        };
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert 1 - Only ConnectionSettings should emit
        connectionEmissions.Should().HaveCount(2, "ConnectionSettings changed");
        playerEmissions.Should().HaveCount(1, "PlayerSettings didn't change");
        fileTransferEmissions.Should().HaveCount(1, "FileTransferSettings didn't change");
        searchEmissions.Should().HaveCount(1, "SearchSettings didn't change");
        appEmissions.Should().HaveCount(1, "AppSettings didn't change");

        // Act 2 - Modify only PlayerSettings
        settings = service.GetSettings();
        settings = settings with
        {
            PlayerSettings = settings.PlayerSettings with
            {
                PlayTimerEnabled = !settings.PlayerSettings.PlayTimerEnabled
            }
        };
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert 2 - Only PlayerSettings should emit (ConnectionSettings stays at 2)
        connectionEmissions.Should().HaveCount(2, "ConnectionSettings didn't change in second save");
        playerEmissions.Should().HaveCount(2, "PlayerSettings changed");
        fileTransferEmissions.Should().HaveCount(1, "FileTransferSettings didn't change");
        searchEmissions.Should().HaveCount(1, "SearchSettings didn't change");
        appEmissions.Should().HaveCount(1, "AppSettings didn't change");

        // Cleanup
        connSub.Dispose();
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
        var connectionEmissions = new List<ConnectionSettings>();
        var subscription = service.ConnectionSettings.Subscribe(connectionEmissions.Add);

        var settings = service.GetSettings();
        
        // Create a new ConnectionSettings with the same values (value equality, different reference)
        settings = settings with
        {
            ConnectionSettings = new ConnectionSettings
            {
                ConnectionType = settings.ConnectionSettings.ConnectionType,
                AutoConnectEnabled = settings.ConnectionSettings.AutoConnectEnabled,
            }
        };

        // Act
        service.SaveSettings(settings);
        await Task.Delay(100);

        // Assert
        subscription.Dispose();
        // Should not emit because values are the same (record value equality)
        connectionEmissions.Should().HaveCount(1, "DistinctUntilChanged uses value equality for records");
    }

    #endregion
}
