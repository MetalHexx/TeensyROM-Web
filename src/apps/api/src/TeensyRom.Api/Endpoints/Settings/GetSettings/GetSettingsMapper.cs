using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Endpoints.Settings.GetSettings
{
    public class GetSettingsMapper : IRadMapper<object, GetSettingsResponse, TeensySettings>
    {
        public GetSettingsResponse FromEntity(TeensySettings entity)
        {
            return new GetSettingsResponse
            {
                //ConnectionSettings = MapConnectionSettings(entity.ConnectionSettings),
                PlayerSettings = MapPlayerSettings(entity.PlayerSettings),
                FileTransferSettings = MapFileTransferSettings(entity.FileTransferSettings),
                SearchSettings = MapSearchSettings(entity.SearchSettings),
                AppSettings = MapAppSettings(entity.AppSettings)
            };
        }

        public TeensySettings ToEntity(object request) => throw new NotImplementedException();

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
