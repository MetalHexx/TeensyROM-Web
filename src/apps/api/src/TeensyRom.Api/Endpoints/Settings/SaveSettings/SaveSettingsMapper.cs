using RadEndpoints;
using TeensyRom.Core.Settings;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Endpoints.Settings.SaveSettings
{
    public class SaveSettingsMapper : IRadMapper<SaveSettingsRequest, SaveSettingsResponse, TeensySettings>
    {
        public SaveSettingsResponse FromEntity(TeensySettings entity)
        {
            return new SaveSettingsResponse
            {
                Message = "Settings saved successfully."
            };
        }

        public TeensySettings ToEntity(SaveSettingsRequest request)
        {
            return new TeensySettings
            {
                //ConnectionSettings = MapConnectionSettings(request.ConnectionSettings),
                PlayerSettings = MapPlayerSettings(request.PlayerSettings),
                FileTransferSettings = MapFileTransferSettings(request.FileTransferSettings),
                SearchSettings = MapSearchSettings(request.SearchSettings),
                AppSettings = MapAppSettings(request.AppSettings)
            };
        }

        // Entity to DTO mappings (for FromEntity)
        private static ConnectionSettingsDto MapConnectionSettingsDto(ConnectionSettings entity)
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

        private static PlayerSettingsDto MapPlayerSettingsDto(PlayerSettings entity)
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

        private static FileTransferSettingsDto MapFileTransferSettingsDto(FileTransferSettings entity)
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

        private static SearchSettingsDto MapSearchSettingsDto(SearchSettings entity)
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

        private static AppSettingsDto MapAppSettingsDto(AppSettings entity)
        {
            return new AppSettingsDto
            {
                FirstTimeSetup = entity.FirstTimeSetup
            };
        }

        // DTO to Entity mappings (for ToEntity)
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
