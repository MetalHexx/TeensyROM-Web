using System.ComponentModel.DataAnnotations;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Endpoints.Settings
{
    /// <summary>
    /// Device connectivity preferences - supports both Serial and TCP/Ethernet connections.
    /// </summary>
    public record ConnectionSettingsDto
    {
        /// <summary>
        /// Connection type preference for device communication.
        /// </summary>
        [Required] public ConnectionType ConnectionType { get; set; } = ConnectionType.Serial;

        /// <summary>
        /// Automatically attempt to connect to devices on startup.
        /// </summary>
        [Required] public bool AutoConnectEnabled { get; set; }

        ///// <summary>
        ///// Serial port specific connection settings.
        ///// </summary>
        //[Required] public SerialConnectionSettingsDto Serial { get; set; } = null!;

        ///// <summary>
        ///// TCP/Ethernet connection settings.
        ///// </summary>
        //[Required] public TcpConnectionSettingsDto Tcp { get; set; } = null!;
    }

    /// <summary>
    /// Serial port specific connection settings.
    /// </summary>
    public record SerialConnectionSettingsDto
    {
        /// <summary>
        /// Serial port name (e.g., COM3). Empty string means auto-detect.
        /// </summary>
        [Required] public string Port { get; set; } = string.Empty;

        /// <summary>
        /// Baud rate for serial communication (typically 115200).
        /// </summary>
        [Required] public int BaudRate { get; set; }
    }

    /// <summary>
    /// TCP/Ethernet connection settings.
    /// </summary>
    public record TcpConnectionSettingsDto
    {
        /// <summary>
        /// Host address (IP or hostname). Empty string means not configured.
        /// </summary>
        [Required] public string HostAddress { get; set; } = string.Empty;

        /// <summary>
        /// TCP port number (1-65535).
        /// </summary>
        [Required] public int Port { get; set; }

        /// <summary>
        /// Connection timeout in milliseconds.
        /// </summary>
        [Required] public int ConnectionTimeoutMs { get; set; }

        /// <summary>
        /// Read timeout in milliseconds.
        /// </summary>
        [Required] public int ReadTimeoutMs { get; set; }

        /// <summary>
        /// Write timeout in milliseconds.
        /// </summary>
        [Required] public int WriteTimeoutMs { get; set; }
    }

    /// <summary>
    /// Playback behavior and player-related preferences.
    /// </summary>
    public record PlayerSettingsDto
    {
        /// <summary>
        /// Enable repeat mode when application starts.
        /// </summary>
        [Required] public bool RepeatModeOnStartup { get; set; }

        /// <summary>
        /// Enable play timer display.
        /// </summary>
        [Required] public bool PlayTimerEnabled { get; set; }

        /// <summary>
        /// Mute audio during fast forward operations.
        /// </summary>
        [Required] public bool MuteFastForward { get; set; }

        /// <summary>
        /// Mute audio during random seek operations.
        /// </summary>
        [Required] public bool MuteRandomSeek { get; set; }

        /// <summary>
        /// Default filter type to apply on startup.
        /// </summary>
        [Required] public TeensyFilterType StartupFilter { get; set; }

        /// <summary>
        /// Automatically launch a file on startup.
        /// </summary>
        [Required] public bool StartupLaunchEnabled { get; set; }

        /// <summary>
        /// Launch a random file on startup (requires StartupLaunchEnabled).
        /// </summary>
        [Required] public bool StartupLaunchRandom { get; set; }
    }

    /// <summary>
    /// Video capture and display preferences.
    /// </summary>
    public record VideoSettingsDto
    {
        /// <summary>
        /// Enable video capture component visibility in player view.
        /// </summary>
        [Required] public bool EnableVideo { get; set; }
    }

    /// <summary>
    /// File transfer, synchronization, and directory watching preferences.
    /// </summary>
    public record FileTransferSettingsDto
    {
        /// <summary>
        /// Directory to watch for new files (e.g., Downloads folder).
        /// </summary>
        [Required] public string WatchDirectoryLocation { get; set; } = string.Empty;

        /// <summary>
        /// Target directory path on TeensyROM device for auto-transferred files.
        /// </summary>
        [Required] public string AutoTransferPath { get; set; } = string.Empty;

        /// <summary>
        /// Automatically copy files from watch directory to device.
        /// </summary>
        [Required] public bool AutoFileCopyEnabled { get; set; }

        /// <summary>
        /// Automatically launch files after copying them.
        /// </summary>
        [Required] public bool AutoLaunchOnCopyEnabled { get; set; }

        /// <summary>
        /// Navigate to the directory after launching a file.
        /// </summary>
        [Required] public bool NavToDirOnLaunch { get; set; }

        /// <summary>
        /// Enable file synchronization between local and device storage.
        /// </summary>
        [Required] public bool SyncFilesEnabled { get; set; }
    }

    /// <summary>
    /// Search behavior, filtering, and content exclusion preferences.
    /// </summary>
    public record SearchSettingsDto
    {
        /// <summary>
        /// Weights for different search fields to control relevance scoring.
        /// </summary>
        [Required] public SearchWeightsDto SearchWeights { get; set; } = null!;

        /// <summary>
        /// Common words to ignore during search indexing.
        /// </summary>
        [Required] public List<string> SearchStopWords { get; set; } = [];

        /// <summary>
        /// Directory names to exclude from search indexing.
        /// </summary>
        [Required] public List<string> BannedDirectories { get; set; } = [];

        /// <summary>
        /// File names to exclude from search indexing.
        /// </summary>
        [Required] public List<string> BannedFiles { get; set; } = [];
    }

    /// <summary>
    /// Weights for different search fields to control relevance scoring.
    /// </summary>
    public record SearchWeightsDto
    {
        /// <summary>
        /// Weight for title field (default: 1.0).
        /// </summary>
        [Required] public double Title { get; set; }

        /// <summary>
        /// Weight for file name field (default: 0.1).
        /// </summary>
        [Required] public double FileName { get; set; }

        /// <summary>
        /// Weight for file path field (default: 0.1).
        /// </summary>
        [Required] public double FilePath { get; set; }

        /// <summary>
        /// Weight for creator field (default: 0.1).
        /// </summary>
        [Required] public double Creator { get; set; }

        /// <summary>
        /// Weight for description field (default: 1.0).
        /// </summary>
        [Required] public double Description { get; set; }
    }

    /// <summary>
    /// Application lifecycle and initial setup state.
    /// </summary>
    public record AppSettingsDto
    {
        /// <summary>
        /// Indicates if this is the first time the application is being run.
        /// </summary>
        [Required] public bool FirstTimeSetup { get; set; }
    }
}
