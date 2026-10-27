using Newtonsoft.Json;
using System.Reactive.Linq;
using System.Reactive.Subjects;
using TeensyRom.Cli.Logging;
using Formatting = Newtonsoft.Json.Formatting;

namespace TeensyRom.Cli.Settings
{
    /// <summary>
    /// Keeps the CLI's <c>Settings.json</c>, which every <c>trom</c> process reads at startup. Reads share the file and
    /// writes go to a temp file that is then moved over it, so concurrent processes never fail on or see a partial file.
    /// </summary>
    public class SettingsService : ISettingsService
    {
        public IObservable<TeensySettings> Settings => _settings.AsObservable();

        private const int CollisionAttempts = 5;
        private static readonly TimeSpan CollisionRetryDelay = TimeSpan.FromMilliseconds(20);

        private BehaviorSubject<TeensySettings> _settings;
        private readonly ILoggingService _logger;

        private string _settingsFilePath => SettingsConstants.SettingsPath;

        public SettingsService(ILoggingService logger)
        {
            _settings = new BehaviorSubject<TeensySettings>(GetSettings());
            _logger = logger;
        }

        public TeensySettings GetSettings()
        {
            var settings = _settings?.Value;

            if (settings is not null)
            {
                return settings.GetClone();
            }

            var path = _settingsFilePath;

            if (File.Exists(path))
            {
                settings = Deserialize(ReadWithRetry(path));
            }
            if(settings is null)
            {
                settings = InitDefaultSettings();
                WriteSettings(settings);
            }
            ValidateAndLogSettings(settings);

            return settings;
        }

        /// <summary>
        /// Parses a settings file's content. Members the file carries that <see cref="TeensySettings"/> doesn't
        /// define (for example a COM port or banned lists) are ignored.
        /// </summary>
        public static TeensySettings? Deserialize(string json) =>
            JsonConvert.DeserializeObject<TeensySettings>(json, new JsonSerializerSettings
            {
                TypeNameHandling = TypeNameHandling.Auto,
                Formatting = Formatting.Indented
            });

        private TeensySettings InitDefaultSettings()
        {
            var settings = new TeensySettings();
            settings.InitializeDefaults();            
            return settings;
        }
        public bool SaveSettings(TeensySettings settings)
        {
            _logger.Internal($"Start Save Settings.");
            _logger.Internal($"Settings file path: {_settingsFilePath}");

            if (!ValidateAndLogSettings(settings)) 
            {
                _logger.InternalError($"Settings failed validation.  Please correct the errors and try again.");
                _logger.InternalError("Writing Settings value");
                var settingsString = JsonConvert.SerializeObject(settings, Formatting.Indented, new JsonSerializerSettings
                {
                    TypeNameHandling = TypeNameHandling.Auto,
                    Formatting = Formatting.Indented
                });                
                _logger.InternalError(settingsString);
                return false;
            }
            try
            {
                _logger.Internal($"Writing Settings to disk");
                WriteSettings(settings);
                _logger.Internal($"Successfully saved settings to disk");
                _settings.OnNext(settings with { });
            }
            catch (Exception ex)
            {
                _logger.InternalError("An error ocurred writing settings to disk");
                _logger.InternalError(ex.ToString());
            }
            _logger.Internal($"Exiting SaveSettings");
            return true;
        }

        private void WriteSettings(TeensySettings settings)
        {
            if (!Directory.Exists(Path.GetDirectoryName(_settingsFilePath)))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(_settingsFilePath)!);
            }
            var json = JsonConvert.SerializeObject(settings, Formatting.Indented, new JsonSerializerSettings
            {
                TypeNameHandling = TypeNameHandling.Auto,
                Formatting = Formatting.Indented
            });
            var temp = $"{_settingsFilePath}.{Guid.NewGuid():N}.tmp";

            try
            {
                File.WriteAllText(temp, json);
                RetryOnCollision(() => File.Move(temp, _settingsFilePath, overwrite: true));
            }
            catch
            {
                try { File.Delete(temp); } catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
                throw;
            }
        }

        /// <summary>
        /// Reads the file without excluding other <c>trom</c> processes, which read it at startup and may replace it.
        /// </summary>
        private static string ReadWithRetry(string path)
        {
            var content = "";
            RetryOnCollision(() =>
            {
                using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
                using var reader = new StreamReader(stream);
                content = reader.ReadToEnd();
            });
            return content;
        }

        /// <summary>A replace of the settings file by another process can briefly collide with this one's open or move: try again shortly.</summary>
        private static void RetryOnCollision(Action action)
        {
            for (var attempt = 1; ; attempt++)
            {
                try
                {
                    action();
                    return;
                }
                catch (Exception ex) when (attempt < CollisionAttempts && ex is IOException or UnauthorizedAccessException)
                {
                    Thread.Sleep(CollisionRetryDelay);
                }
            }
        }

        public bool ValidateAndLogSettings(TeensySettings settings)
        {
            return true;
        }
    }
}