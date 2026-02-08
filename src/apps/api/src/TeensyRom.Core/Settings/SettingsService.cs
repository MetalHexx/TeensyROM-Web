using System.Reactive.Linq;
using System.Reactive.Subjects;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;

namespace TeensyRom.Core.Settings
{
    public class SettingsService : ISettingsService
    {
        public IObservable<TeensySettings> Settings => _settings.AsObservable();
        
        public IObservable<List<DeviceSettings>> KnownDevices =>
            _settings
                .Select(s => s.KnownDevices)
                .DistinctUntilListChanged();
        
        public IObservable<PlayerSettings> PlayerSettings => 
            _settings.Select(s => s.PlayerSettings).DistinctUntilChanged();
        
        public IObservable<FileTransferSettings> FileTransferSettings => 
            _settings.Select(s => s.FileTransferSettings).DistinctUntilChanged();
        
        public IObservable<SearchSettings> SearchSettings => 
            _settings.Select(s => s.SearchSettings).DistinctUntilChanged();
        
        public IObservable<AppSettings> AppSettings => 
            _settings.Select(s => s.AppSettings).DistinctUntilChanged();

        private BehaviorSubject<TeensySettings> _settings;
        private TeensySettings? _currentSettings;
        private string _settingsFilePath => Path.Combine(Assembly.GetExecutingAssembly().GetDataPath(), SettingsConstants.SettingsPath);

        private readonly object _lock = new object();

        private readonly ILoggingService _log;

        public SettingsService(ILoggingService log)
        {
            _log = log;
            _settings = new BehaviorSubject<TeensySettings>(GetSettings());
        }

        public TeensySettings GetSettings()
        {
            lock (_lock)
            {
                if (_currentSettings is not null) return _currentSettings with { };

                if (File.Exists(_settingsFilePath))
                {
                    using var stream = File.Open(_settingsFilePath, FileMode.Open, FileAccess.Read);
                    using var reader = new StreamReader(stream);
                    var content = reader.ReadToEnd();

                    _currentSettings = LaunchableItemSerializer.Deserialize<TeensySettings>(content);
                }
                if (_currentSettings is null)
                {
                    _currentSettings = InitDefaultSettings();
                    WriteSettings(_currentSettings);
                }
                ValidateAndLogSettings(_currentSettings);

                return _currentSettings with { };
            }
        }

        public PlayerSettings GetPlayerSettings() => GetSettings().PlayerSettings;
        public FileTransferSettings GetFileTransferSettings() => GetSettings().FileTransferSettings;
        public SearchSettings GetSearchSettings() => GetSettings().SearchSettings;
        public AppSettings GetAppSettings() => GetSettings().AppSettings;

        /// <summary>
        /// Gets settings for a specific device by ID.
        /// </summary>
        /// <param name="deviceId">The unique device identifier.</param>
        /// <returns>The device settings if found; null otherwise.</returns>
        public DeviceSettings? GetDeviceSettings(string deviceId)
        {
            var settings = GetSettings();
            return settings.KnownDevices.FirstOrDefault(d => d.DeviceId == deviceId);
        }

        /// <summary>
        /// Gets settings for a device, creating a new entry with defaults if not found.
        /// New devices are created with: EnableVideo=false, AutoConnectEnabled=true.
        /// </summary>
        /// <param name="deviceId">The unique device identifier.</param>
        /// <returns>The existing or newly created device settings.</returns>
        public DeviceSettings GetOrCreateDeviceSettings(string deviceId)
        {
            lock (_lock)
            {
                var existing = _currentSettings?.KnownDevices.FirstOrDefault(d => d.DeviceId == deviceId);
                if (existing != null) return existing;

                var newDevice = new DeviceSettings
                {
                    DeviceId = deviceId,
                    VideoSettings = new VideoSettings { EnableVideo = false }
                };

                if (_currentSettings is null)
                {
                    _currentSettings = InitDefaultSettings();
                }

                // Create new settings with new list containing the new device (immutable pattern)
                var updatedDevices = new List<DeviceSettings>(_currentSettings.KnownDevices) { newDevice };
                var updatedSettings = _currentSettings with { KnownDevices = updatedDevices };
                SaveSettings(updatedSettings);
                
                _log.Internal($"Created new device settings for device: {deviceId}");
                
                return newDevice;
            }
        }

        /// <summary>
        /// Updates and persists settings for a specific device.
        /// </summary>
        /// <param name="deviceSettings">The device settings to save.</param>
        public void SaveDeviceSettings(DeviceSettings deviceSettings)
        {
            lock (_lock)
            {
                if (_currentSettings is null)
                {
                    _currentSettings = InitDefaultSettings();
                }

                // Create new list with updated device (immutable pattern)
                var updatedDevices = new List<DeviceSettings>(_currentSettings.KnownDevices);
                var existingIndex = updatedDevices.FindIndex(d => d.DeviceId == deviceSettings.DeviceId);

                if (existingIndex >= 0)
                {
                    updatedDevices[existingIndex] = deviceSettings;
                }
                else
                {
                    updatedDevices.Add(deviceSettings);
                }

                var updatedSettings = _currentSettings with { KnownDevices = updatedDevices };
                SaveSettings(updatedSettings);
                _log.Internal($"Saved device settings for device: {deviceSettings.DeviceId}");
            }
        }

        private TeensySettings InitDefaultSettings()
        {
            return new TeensySettings();
        }

        private void WriteSettings(TeensySettings settings)
        {
            if (!Directory.Exists(Path.GetDirectoryName(_settingsFilePath)))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(_settingsFilePath)!);
            }
            File.WriteAllText(_settingsFilePath, LaunchableItemSerializer.Serialize(settings));
        }

        public bool ValidateAndLogSettings(TeensySettings settings)
        {
            if (!Directory.Exists(settings.FileTransferSettings.WatchDirectoryLocation))
            {
                _log.InternalError($"The watch directory '{settings.FileTransferSettings.WatchDirectoryLocation}' was not found.  Please go create it.");
                return false;
            }
            return true;
        }

        public bool SaveSettings(TeensySettings settings)
        {
            lock (_lock)
            {
                _settings.OnNext(settings);
                WriteSettings(settings);
                _currentSettings = settings;
                return true;
            }
        }

        public static string GetFileNameSafeHash(string stringToHash)
        {
            using (var md5 = MD5.Create())
            {
                byte[] inputBytes = Encoding.UTF8.GetBytes(stringToHash);
                byte[] hashBytes = md5.ComputeHash(inputBytes);
                return string.Concat(hashBytes.Select(b => b.ToString("X2")));
            }
        }
    }
}
