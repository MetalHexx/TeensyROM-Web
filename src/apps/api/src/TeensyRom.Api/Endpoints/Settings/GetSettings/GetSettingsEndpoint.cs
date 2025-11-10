using RadEndpoints;
using TeensyRom.Api.Endpoints.Settings;
using TeensyRom.Core.Settings;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Endpoints.Settings.GetSettings
{
    public class GetSettingsEndpoint(ISettingsService settingsService) 
        : RadEndpointWithoutRequest<GetSettingsResponse>
    {
        public override void Configure()
        {
            Get("/settings")
                .Produces<GetSettingsResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("GetSettings")
                .WithSummary("Get User Settings")
                .WithTags("Settings")
                .WithDescription(
                    "Retrieves all current user settings for the TeensyROM application.\n\n" +
                    "**Settings Categories:**\n" +
                    "- **Connection Settings**: Device connectivity preferences (Serial/TCP)\n" +
                    "- **Player Settings**: Playback behavior and startup preferences\n" +
                    "- **File Transfer Settings**: Auto-copy and directory watching configuration\n" +
                    "- **Search Settings**: Search weights, stop words, and content exclusions\n" +
                    "- **App Settings**: Application lifecycle state\n\n" +
                    "Settings are loaded from the Settings.json file and cached in memory. " +
                    "This endpoint always returns the current in-memory settings state."
                );
        }

        public override Task Handle(CancellationToken ct)
        {
            var settings = settingsService.GetSettings();
            Response = MapFromEntity(settings);
            Send();
            return Task.CompletedTask;
        }

        private static GetSettingsResponse MapFromEntity(TeensySettings entity)
        {
            return new GetSettingsResponse
            {
                ConnectionSettings = MapConnectionSettings(entity.ConnectionSettings),
                PlayerSettings = MapPlayerSettings(entity.PlayerSettings),
                FileTransferSettings = MapFileTransferSettings(entity.FileTransferSettings),
                SearchSettings = MapSearchSettings(entity.SearchSettings),
                AppSettings = MapAppSettings(entity.AppSettings)
            };
        }

        private static ConnectionSettingsDto MapConnectionSettings(ConnectionSettings entity)
        {
            return new ConnectionSettingsDto
            {
                ConnectionType = entity.ConnectionType,
                AutoConnectEnabled = entity.AutoConnectEnabled,
                Serial = new SerialConnectionSettingsDto
                {
                    Port = entity.Serial.Port,
                    BaudRate = entity.Serial.BaudRate
                },
                Tcp = new TcpConnectionSettingsDto
                {
                    HostAddress = entity.Tcp.HostAddress,
                    Port = entity.Tcp.Port,
                    ConnectionTimeoutMs = entity.Tcp.ConnectionTimeoutMs,
                    ReadTimeoutMs = entity.Tcp.ReadTimeoutMs,
                    WriteTimeoutMs = entity.Tcp.WriteTimeoutMs
                }
            };
        }

        private static PlayerSettingsDto MapPlayerSettings(PlayerSettings entity)
        {
            return new PlayerSettingsDto
            {
                RepeatModeOnStartup = entity.RepeatModeOnStartup,
                PlayTimerEnabled = entity.PlayTimerEnabled,
                MuteFastForward = entity.MuteFastForward,
                MuteRandomSeek = entity.MuteRandomSeek,
                StartupFilter = entity.StartupFilter,
                StartupLaunchEnabled = entity.StartupLaunchEnabled,
                StartupLaunchRandom = entity.StartupLaunchRandom
            };
        }

        private static FileTransferSettingsDto MapFileTransferSettings(FileTransferSettings entity)
        {
            return new FileTransferSettingsDto
            {
                WatchDirectoryLocation = entity.WatchDirectoryLocation,
                AutoTransferPath = entity.AutoTransferPath.ToString(),
                AutoFileCopyEnabled = entity.AutoFileCopyEnabled,
                AutoLaunchOnCopyEnabled = entity.AutoLaunchOnCopyEnabled,
                NavToDirOnLaunch = entity.NavToDirOnLaunch,
                SyncFilesEnabled = entity.SyncFilesEnabled
            };
        }

        private static SearchSettingsDto MapSearchSettings(SearchSettings entity)
        {
            return new SearchSettingsDto
            {
                SearchWeights = new SearchWeightsDto
                {
                    Title = entity.SearchWeights.Title,
                    FileName = entity.SearchWeights.FileName,
                    FilePath = entity.SearchWeights.FilePath,
                    Creator = entity.SearchWeights.Creator,
                    Description = entity.SearchWeights.Description
                },
                SearchStopWords = entity.SearchStopWords,
                BannedDirectories = entity.BannedDirectories,
                BannedFiles = entity.BannedFiles
            };
        }

        private static AppSettingsDto MapAppSettings(AppSettings entity)
        {
            return new AppSettingsDto
            {
                FirstTimeSetup = entity.FirstTimeSetup
            };
        }
    }
}
