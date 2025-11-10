using RadEndpoints;
using TeensyRom.Api.Endpoints.Settings;
using TeensyRom.Core.Settings;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Endpoints.Settings.SaveSettings
{
    public class SaveSettingsEndpoint(ISettingsService settingsService) 
        : RadEndpoint<SaveSettingsRequest, SaveSettingsResponse>
    {
        public override void Configure()
        {
            Post("/settings")
                .Produces<SaveSettingsResponse>(StatusCodes.Status200OK)
                .ProducesValidationProblem(StatusCodes.Status400BadRequest)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("SaveSettings")
                .WithSummary("Save User Settings")
                .WithTags("Settings")
                .WithDescription(
                    "Saves all user settings for the TeensyROM application to persistent storage.\n\n" +
                    "**Settings Categories:**\n" +
                    "- **Connection Settings**: Device connectivity preferences (Serial/TCP)\n" +
                    "  - Serial: Port name (empty for auto-detect) and baud rate (typically 115200)\n" +
                    "  - TCP: Host address, port (1-65535), and timeout values (milliseconds)\n" +
                    "- **Player Settings**: Playback behavior and startup preferences\n" +
                    "  - Repeat mode, play timer, mute settings, startup filter and launch options\n" +
                    "- **File Transfer Settings**: Auto-copy and directory watching configuration\n" +
                    "  - Watch directory location, auto-transfer path, and sync flags\n" +
                    "- **Search Settings**: Search weights, stop words, and content exclusions\n" +
                    "  - Search weights must be >= 0 with at least one > 0\n" +
                    "  - Stop words, banned directories, and banned files lists\n" +
                    "- **App Settings**: Application lifecycle state\n" +
                    "  - First-time setup flag\n\n" +
                    "**Validation:**\n" +
                    "- All nested settings objects are required\n" +
                    "- Baud rate must be positive (typically 9600, 19200, 38400, 57600, or 115200)\n" +
                    "- TCP port must be between 1 and 65535\n" +
                    "- Timeout values must be positive integers (milliseconds)\n" +
                    "- Watch directory must be empty or a valid absolute path\n" +
                    "- Search weights must be non-negative with at least one > 0\n\n" +
                    "Settings are persisted to Settings.json and immediately available in memory."
                );
        }

        public override Task Handle(SaveSettingsRequest request, CancellationToken ct)
        {
            var settings = MapToEntity(request);
            var saveSuccess = settingsService.SaveSettings(settings);

            if (!saveSuccess)
            {
                SendExternalError("Failed to save settings to disk. Please check file permissions and try again.");
                return Task.CompletedTask;
            }

            Response = new SaveSettingsResponse
            {
                Message = "Settings saved successfully.",
                SavedSettings = request
            };

            Send();
            return Task.CompletedTask;
        }

        private static TeensySettings MapToEntity(SaveSettingsRequest dto)
        {
            return new TeensySettings
            {
                ConnectionSettings = MapConnectionSettings(dto.ConnectionSettings),
                PlayerSettings = MapPlayerSettings(dto.PlayerSettings),
                FileTransferSettings = MapFileTransferSettings(dto.FileTransferSettings),
                SearchSettings = MapSearchSettings(dto.SearchSettings),
                AppSettings = MapAppSettings(dto.AppSettings)
            };
        }

        private static ConnectionSettings MapConnectionSettings(ConnectionSettingsDto dto)
        {
            return new ConnectionSettings
            {
                ConnectionType = dto.ConnectionType,
                AutoConnectEnabled = dto.AutoConnectEnabled,
                Serial = new SerialConnectionSettings
                {
                    Port = dto.Serial.Port,
                    BaudRate = dto.Serial.BaudRate
                },
                Tcp = new TcpConnectionSettings
                {
                    HostAddress = dto.Tcp.HostAddress,
                    Port = dto.Tcp.Port,
                    ConnectionTimeoutMs = dto.Tcp.ConnectionTimeoutMs,
                    ReadTimeoutMs = dto.Tcp.ReadTimeoutMs,
                    WriteTimeoutMs = dto.Tcp.WriteTimeoutMs
                }
            };
        }

        private static PlayerSettings MapPlayerSettings(PlayerSettingsDto dto)
        {
            return new PlayerSettings
            {
                RepeatModeOnStartup = dto.RepeatModeOnStartup,
                PlayTimerEnabled = dto.PlayTimerEnabled,
                MuteFastForward = dto.MuteFastForward,
                MuteRandomSeek = dto.MuteRandomSeek,
                StartupFilter = dto.StartupFilter,
                StartupLaunchEnabled = dto.StartupLaunchEnabled,
                StartupLaunchRandom = dto.StartupLaunchRandom
            };
        }

        private static FileTransferSettings MapFileTransferSettings(FileTransferSettingsDto dto)
        {
            return new FileTransferSettings
            {
                WatchDirectoryLocation = dto.WatchDirectoryLocation,
                AutoTransferPath = new DirectoryPath(dto.AutoTransferPath),
                AutoFileCopyEnabled = dto.AutoFileCopyEnabled,
                AutoLaunchOnCopyEnabled = dto.AutoLaunchOnCopyEnabled,
                NavToDirOnLaunch = dto.NavToDirOnLaunch,
                SyncFilesEnabled = dto.SyncFilesEnabled
            };
        }

        private static SearchSettings MapSearchSettings(SearchSettingsDto dto)
        {
            return new SearchSettings
            {
                SearchWeights = new SearchWeights
                {
                    Title = dto.SearchWeights.Title,
                    FileName = dto.SearchWeights.FileName,
                    FilePath = dto.SearchWeights.FilePath,
                    Creator = dto.SearchWeights.Creator,
                    Description = dto.SearchWeights.Description
                },
                SearchStopWords = dto.SearchStopWords,
                BannedDirectories = dto.BannedDirectories,
                BannedFiles = dto.BannedFiles
            };
        }

        private static AppSettings MapAppSettings(AppSettingsDto dto)
        {
            return new AppSettings
            {
                FirstTimeSetup = dto.FirstTimeSetup
            };
        }
    }
}
