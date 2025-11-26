using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.Settings.GetSettings
{
    /// <summary>
    /// Response model containing all TeensyROM user settings.
    /// </summary>
    public record GetSettingsResponse
    {
        /// <summary>
        /// Device connectivity preferences - supports both Serial and TCP/Ethernet connections.
        /// </summary>
        [Required] public ConnectionSettingsDto ConnectionSettings { get; set; } = null!;

        /// <summary>
        /// Playback behavior and player-related preferences.
        /// </summary>
        [Required] public PlayerSettingsDto PlayerSettings { get; set; } = null!;

        /// <summary>
        /// Video capture and display preferences.
        /// </summary>
        [Required] public VideoSettingsDto VideoSettings { get; set; } = null!;

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
