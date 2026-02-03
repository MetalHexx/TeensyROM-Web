using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Endpoints.Settings.GetSettings
{
    public class GetSettingsMapper : IRadMapper<object, GetSettingsResponse, TeensySettings>
    {
        public GetSettingsResponse FromEntity(TeensySettings entity)
        {
            return new GetSettingsResponse
            {
                KnownDevices = entity.KnownDevices.Select(MapDeviceSettings).ToList(),
                PlayerSettings = MapPlayerSettings(entity.PlayerSettings),
                FileTransferSettings = MapFileTransferSettings(entity.FileTransferSettings),
                SearchSettings = MapSearchSettings(entity.SearchSettings),
                AppSettings = MapAppSettings(entity.AppSettings)
            };
        }

        public TeensySettings ToEntity(object request) => throw new NotImplementedException();

        private static DeviceSettingsDto MapDeviceSettings(DeviceSettings entity)
        {
            return new DeviceSettingsDto
            {
                DeviceId = entity.DeviceId,
                VideoSettings = MapVideoSettings(entity.VideoSettings),
                ConnectionSettings = MapConnectionSettings(entity.ConnectionSettings),
                IndexingStatus = MapIndexingStatus(entity.IndexingStatus)
            };
        }

        private static ConnectionSettingsDto MapConnectionSettings(ConnectionSettings entity)
        {
            return new ConnectionSettingsDto
            {
                AutoConnectEnabled = entity.AutoConnectEnabled
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

        private static VideoSettingsDto MapVideoSettings(VideoSettings entity)
        {
            return new VideoSettingsDto
            {
                EnableVideo = entity.EnableVideo,
                VideoDeviceId = entity.VideoDeviceId
            };
        }

        private static IndexingStatusDto MapIndexingStatus(IndexingStatus entity)
        {
            return new IndexingStatusDto
            {
                SdLastIndexed = entity.SdLastIndexed,
                UsbLastIndexed = entity.UsbLastIndexed
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
