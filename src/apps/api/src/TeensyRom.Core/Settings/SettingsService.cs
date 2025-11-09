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
        public IObservable<ConnectionSettings> ConnectionSettings => 
            _settings.Select(s => s.ConnectionSettings).DistinctUntilChanged();
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
        private string _settingsFilePath => Path.Combine(Assembly.GetExecutingAssembly().GetPath(), SettingsConstants.SettingsPath);

        private readonly ILoggingService _log;

        public SettingsService(ILoggingService log)
        {
            _log = log;
            _settings = new BehaviorSubject<TeensySettings>(GetSettings());
        }

        public TeensySettings GetSettings()
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

        public ConnectionSettings GetConnectionSettings() => GetSettings().ConnectionSettings;
        public PlayerSettings GetPlayerSettings() => GetSettings().PlayerSettings;
        public FileTransferSettings GetFileTransferSettings() => GetSettings().FileTransferSettings;
        public SearchSettings GetSearchSettings() => GetSettings().SearchSettings;
        public AppSettings GetAppSettings() => GetSettings().AppSettings;

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
            _settings.OnNext(settings);
            WriteSettings(settings);
            _currentSettings = settings;
            return true;
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
