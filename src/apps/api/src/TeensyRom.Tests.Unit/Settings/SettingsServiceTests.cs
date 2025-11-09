using System.Reactive.Linq;
using System.Reactive.Threading.Tasks;
using System.Reflection;
using AutoFixture;
using TeensyRom.Api.Services;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;

namespace TeensyRom.Tests.Unit.Settings;

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
        settings.DeviceId.Should().Be(string.Empty);
        settings.ConnectionSettings.Should().NotBeNull();
        settings.ConnectionSettings.AutoConnectEnabled.Should().BeTrue();
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
        var originalDeviceId = originalSettings.DeviceId;

        // Act - Modify the returned copy
        var copiedSettings = service.GetSettings();
        copiedSettings.DeviceId = "Modified-ID";

        // Assert - Original should not be affected
        var refreshedSettings = service.GetSettings();
        refreshedSettings.DeviceId.Should().Be(originalDeviceId);
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
            DeviceId = "TEST-DEVICE-123",
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
        actualSettings.DeviceId.Should().Be(expectedSettings.DeviceId);
        actualSettings.ConnectionSettings.ConnectionType.Should().Be(expectedSettings.ConnectionSettings.ConnectionType);
        actualSettings.ConnectionSettings.AutoConnectEnabled.Should().Be(expectedSettings.ConnectionSettings.AutoConnectEnabled);
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
        newSettings.DeviceId = "UNIQUE-TEST-ID-" + Guid.NewGuid();

        // Act
        var result = service.SaveSettings(newSettings);

        // Assert
        result.Should().BeTrue();
        File.Exists(_settingsFilePath).Should().BeTrue();
        
        // Verify by reading the file directly
        var fileContent = File.ReadAllText(_settingsFilePath);
        fileContent.Should().Contain(newSettings.DeviceId);
    }

    [Fact]
    public void SaveSettings_ShouldUpdateCachedSettings()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var newSettings = service.GetSettings();
        newSettings.DeviceId = "UPDATED-DEVICE-ID";

        // Act
        service.SaveSettings(newSettings);
        var retrievedSettings = service.GetSettings();

        // Assert
        retrievedSettings.DeviceId.Should().Be("UPDATED-DEVICE-ID");
    }

    [Fact]
    public void SaveSettings_ShouldEmitNewSettings_ToObservable()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
        var initialSettings = service.GetSettings();
        var newSettings = initialSettings with { DeviceId = "NEW-ID-" + Guid.NewGuid() };
        TeensySettings? emittedSettings = null;
        
        // Subscribe after initial emission
        service.Settings.Skip(1).Take(1).Subscribe(s => emittedSettings = s);

        // Act
        service.SaveSettings(newSettings);

        // Assert
        emittedSettings.Should().NotBeNull();
        emittedSettings!.DeviceId.Should().Be(newSettings.DeviceId);
    }

    [Fact]
    public void SaveSettings_ShouldOverwriteExistingFile()
    {
        // Arrange
        var service1 = new SettingsService(_mockLogger);
        var initialSettings = service1.GetSettings();
        initialSettings.DeviceId = "INITIAL-ID";
        service1.SaveSettings(initialSettings);
        
        var service2 = new SettingsService(_mockLogger);
        var newSettings = service2.GetSettings();
        newSettings.DeviceId = "FINAL-ID";

        // Act
        service2.SaveSettings(newSettings);

        // Assert
        var service3 = new SettingsService(_mockLogger);
        var retrievedSettings = service3.GetSettings();
        retrievedSettings.DeviceId.Should().Be("FINAL-ID");
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
                settings.DeviceId = $"Device-{localI}";
                service.SaveSettings(settings);
            }));
        }

        await Task.WhenAll(tasks);

        // Assert
        File.Exists(_settingsFilePath).Should().BeTrue();
        var finalSettings = service.GetSettings();
        finalSettings.Should().NotBeNull();
        finalSettings.DeviceId.Should().StartWith("Device-");
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
        newSettings.DeviceId = "CHANGED-" + Guid.NewGuid();

        // Act
        service.SaveSettings(newSettings);
        await Task.Delay(100); // Allow observable to emit

        // Assert
        subscription.Dispose();
        emittedSettings.Should().HaveCountGreaterThanOrEqualTo(2); // Initial + updated
        emittedSettings.Last().DeviceId.Should().Be(newSettings.DeviceId);
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
        newSettings.DeviceId = "MULTI-SUB-" + Guid.NewGuid();

        // Act
        service.SaveSettings(newSettings);
        await Task.Delay(100);

        // Assert
        sub1.Dispose();
        sub2.Dispose();
        
        subscriber1Values.Should().HaveCountGreaterThanOrEqualTo(2);
        subscriber2Values.Should().HaveCountGreaterThanOrEqualTo(2);
        subscriber1Values.Last().DeviceId.Should().Be(subscriber2Values.Last().DeviceId);
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
        settings.ConnectionSettings.ConnectionType = newConnectionType;

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
        settings.PlayerSettings.RepeatModeOnStartup = !settings.PlayerSettings.RepeatModeOnStartup;

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
        settings.FileTransferSettings.AutoFileCopyEnabled = !settings.FileTransferSettings.AutoFileCopyEnabled;

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
        settings.SearchSettings.BannedFiles.Add(uniqueFile);

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
        settings.AppSettings.FirstTimeSetup = !settings.AppSettings.FirstTimeSetup;

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
        // Arrange
        var service = new SettingsService(_mockLogger);
        var settings = service.GetSettings();
        settings.FileTransferSettings.WatchDirectoryLocation = _testWatchDirectory;

        // Act
        var result = service.ValidateAndLogSettings(settings);

        // Assert
        result.Should().BeTrue();
        _mockLogger.DidNotReceive().InternalError(Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public void ValidateAndLogSettings_ShouldReturnFalse_WhenWatchDirectoryDoesNotExist()
    {
        // Arrange
        var service = new SettingsService(_mockLogger);
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
        settings.DeviceId = "TEST-123";
        settings.ConnectionSettings.AutoConnectEnabled = true;

        // Act
        service.SaveSettings(settings);

        // Assert
        var fileContent = File.ReadAllText(_settingsFilePath);
        fileContent.Should().Contain("\"deviceId\""); // camelCase
        fileContent.Should().Contain("TEST-123");
        fileContent.Should().Contain("connectionSettings");
    }

    [Fact]
    public void Settings_ShouldHandleCorruptedJsonFile_Gracefully()
    {
        // Arrange
        Directory.CreateDirectory(Path.GetDirectoryName(_settingsFilePath)!);
        File.WriteAllText(_settingsFilePath, "{ invalid json content }");

        // Act
        var service = new SettingsService(_mockLogger);
        var settings = service.GetSettings();

        // Assert - Should fall back to defaults
        settings.Should().NotBeNull();
        settings.DeviceId.Should().Be(string.Empty);
    }

    [Fact]
    public void Settings_ShouldHandleEmptyJsonFile_Gracefully()
    {
        // Arrange
        Directory.CreateDirectory(Path.GetDirectoryName(_settingsFilePath)!);
        File.WriteAllText(_settingsFilePath, "");

        // Act
        var service = new SettingsService(_mockLogger);
        var settings = service.GetSettings();

        // Assert
        settings.Should().NotBeNull();
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
        connectionSettings.Serial.Should().NotBeNull();
        connectionSettings.Tcp.Should().NotBeNull();
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
        var uniqueId = Guid.NewGuid().ToString();
        var settings = service1.GetSettings();
        settings.DeviceId = uniqueId;
        service1.SaveSettings(settings);

        // Act
        var service2 = new SettingsService(_mockLogger);
        var loadedSettings = service2.GetSettings();

        // Assert
        loadedSettings.DeviceId.Should().Be(uniqueId);
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
        settings.ConnectionSettings.AutoConnectEnabled = !settings.ConnectionSettings.AutoConnectEnabled;
        settings.PlayerSettings.RepeatModeOnStartup = !settings.PlayerSettings.RepeatModeOnStartup;

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
}
