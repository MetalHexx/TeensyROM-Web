using RadEndpoints;
using TeensyRom.Core.Settings;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Endpoints.Settings.SaveSettings
{
    public class SaveSettingsMapper(ISettingsService settingsService) 
        : IRadMapper<SaveSettingsRequest, SaveSettingsResponse, TeensySettings>
    {
        public SaveSettingsResponse FromEntity(TeensySettings entity)
        {
            return new SaveSettingsResponse
            {
                Message = "Settings saved successfully."
            };
        }

        /// <summary>
        /// Maps request to entity while preserving backend-managed fields from existing settings.
        /// Device entries are applied by ID onto the existing list: a request never adds or removes an entry,
        /// an entry the request omits is kept as-is, and an ID repeated in the request uses its first occurrence.
        /// </summary>
        public TeensySettings ToEntity(SaveSettingsRequest request)
        {
            var existingSettings = settingsService.GetSettings();

            var requestedById = new Dictionary<string, DeviceSettingsDto>();
            foreach (var dto in request.KnownDevices)
            {
                requestedById.TryAdd(dto.DeviceId, dto);
            }

            return new TeensySettings
            {
                KnownDevices = existingSettings.KnownDevices
                    .Select(existing => requestedById.TryGetValue(existing.DeviceId, out var dto)
                        ? MapDeviceSettings(dto, existing)
                        : existing)
                    .ToList(),
                PlayerSettings = MapPlayerSettings(request.PlayerSettings),
                FileTransferSettings = MapFileTransferSettings(request.FileTransferSettings),
                SearchSettings = MapSearchSettings(request.SearchSettings),
                AppSettings = MapAppSettings(request.AppSettings)
            };
        }

        /// <summary>
        /// Maps device settings DTO to entity while preserving IndexingStatus from the existing entry.
        /// IndexingStatus is backend-managed and should not be overwritten by frontend requests.
        /// </summary>
        private static DeviceSettings MapDeviceSettings(DeviceSettingsDto dto, DeviceSettings existing)
        {
            return new DeviceSettings
            {
                DeviceId = existing.DeviceId,
                VideoSettings = MapVideoSettings(dto.VideoSettings),
                AudioSettings = MapAudioSettings(dto.AudioSettings),
                IndexingStatus = existing.IndexingStatus
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

        private static AudioSettings MapAudioSettings(AudioSettingsDto dto)
        {
            return new AudioSettings
            {
                EnableAudioStream = dto.EnableAudioStream,
                AudioDeviceIndex = dto.AudioDeviceIndex,
                AudioDeviceName = dto.AudioDeviceName,
                CaptureChannelCount = dto.CaptureChannelCount > 0 ? dto.CaptureChannelCount : 1,
                SampleRate = dto.SampleRate,
                Channels = dto.Channels?.Select(MapChannelConfig).ToList() ?? [],
                UseOpusEncoding = dto.UseOpusEncoding
            };
        }

        private static ChannelConfig MapChannelConfig(ChannelConfigDto dto)
        {
            return new ChannelConfig
            {
                SourceChannel = dto.SourceChannel,
                Enabled = dto.Enabled
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
