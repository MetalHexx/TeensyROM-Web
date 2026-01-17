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
                KnownDevices = request.KnownDevices.Select(MapDeviceSettings).ToList(),
                PlayerSettings = MapPlayerSettings(request.PlayerSettings),
                FileTransferSettings = MapFileTransferSettings(request.FileTransferSettings),
                SearchSettings = MapSearchSettings(request.SearchSettings),
                AppSettings = MapAppSettings(request.AppSettings)
            };
        }

        // DTO to Entity mappings
        private static DeviceSettings MapDeviceSettings(DeviceSettingsDto dto)
        {
            return new DeviceSettings
            {
                DeviceId = dto.DeviceId,
                VideoSettings = MapVideoSettings(dto.VideoSettings),
                ConnectionSettings = MapConnectionSettings(dto.ConnectionSettings)
            };
        }

        private static ConnectionSettings MapConnectionSettings(ConnectionSettingsDto dto)
        {
            return new ConnectionSettings
            {
                AutoConnectEnabled = dto.AutoConnectEnabled,
                //Serial = new SerialConnectionSettings
                //{
                //    Port = dto.Serial.Port,
                //    BaudRate = dto.Serial.BaudRate
                //},
                //Tcp = new TcpConnectionSettings
                //{
                //    HostAddress = dto.Tcp.HostAddress,
                //    Port = dto.Tcp.Port,
                //    ConnectionTimeoutMs = dto.Tcp.ConnectionTimeoutMs,
                //    ReadTimeoutMs = dto.Tcp.ReadTimeoutMs,
                //    WriteTimeoutMs = dto.Tcp.WriteTimeoutMs
                //}
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

        private static VideoSettings MapVideoSettings(VideoSettingsDto dto)
        {
            return new VideoSettings
            {
                EnableVideo = dto.EnableVideo,
                VideoDeviceId = dto.VideoDeviceId
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
