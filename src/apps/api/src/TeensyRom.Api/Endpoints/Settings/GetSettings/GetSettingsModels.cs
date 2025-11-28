using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.Settings.GetSettings
{
    /// <summary>
    /// Response model containing all TeensyROM user settings.
    /// </summary>
    public record GetSettingsResponse
    {
        /// <summary>
        /// List of known devices with their per-device settings.
        /// Each device has its own video and connection preferences.
        /// </summary>
        [Required] public List<DeviceSettingsDto> KnownDevices { get; set; } = [];

        /// <summary>
        /// Playback behavior and player-related preferences.
        /// </summary>
        [Required] public PlayerSettingsDto PlayerSettings { get; set; } = null!;

        /// <summary>
        /// File transfer, synchronization, and directory watching preferences.
        /// </summary>
        [Required] public FileTransferSettingsDto FileTransferSettings { get; set; } = null!;

        /// <summary>
        /// Search behavior, filtering, and content exclusion preferences.
        /// </summary>
        [Required] public SearchSettingsDto SearchSettings { get; set; } = null!;

        /// <summary>
        /// Application lifecycle and initial setup state.
        /// </summary>
        [Required] public AppSettingsDto AppSettings { get; set; } = null!;
    }
}
