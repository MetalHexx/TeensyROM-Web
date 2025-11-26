using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.Settings.SaveSettings
{
    /// <summary>
    /// Request model for saving all TeensyROM user settings.
    /// </summary>
    public record SaveSettingsRequest
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

    /// <summary>
    /// Response model for the result of saving settings.
    /// </summary>
    public record SaveSettingsResponse
    {
        /// <summary>
        /// A message indicating the result of the save operation.
        /// </summary>
        [Required] public string Message { get; set; } = "Settings saved successfully.";
    }

    // Validators
    public class SaveSettingsRequestValidator : AbstractValidator<SaveSettingsRequest>
    {
        public SaveSettingsRequestValidator()
        {
            RuleFor(x => x.ConnectionSettings)
                .NotNull().WithMessage("Connection settings are required.")
                .SetValidator(new ConnectionSettingsValidator());

            RuleFor(x => x.PlayerSettings)
                .NotNull().WithMessage("Player settings are required.")
                .SetValidator(new PlayerSettingsValidator());

            RuleFor(x => x.VideoSettings)
                .NotNull().WithMessage("Video settings are required.")
                .SetValidator(new VideoSettingsValidator());

            RuleFor(x => x.FileTransferSettings)
                .NotNull().WithMessage("File transfer settings are required.")
                .SetValidator(new FileTransferSettingsValidator());

            RuleFor(x => x.SearchSettings)
                .NotNull().WithMessage("Search settings are required.")
                .SetValidator(new SearchSettingsValidator());

            RuleFor(x => x.AppSettings)
                .NotNull().WithMessage("App settings are required.")
                .SetValidator(new AppSettingsValidator());
        }
    }

    public class ConnectionSettingsValidator : AbstractValidator<ConnectionSettingsDto>
    {
        public ConnectionSettingsValidator()
        {
            RuleFor(x => x.ConnectionType)
                .IsInEnum().WithMessage("Connection type must be a valid enum value (Serial or Tcp).");

            //RuleFor(x => x.Serial)
            //    .NotNull().WithMessage("Serial connection settings are required.")
            //    .SetValidator(new SerialConnectionSettingsValidator());

            //RuleFor(x => x.Tcp)
            //    .NotNull().WithMessage("TCP connection settings are required.")
            //    .SetValidator(new TcpConnectionSettingsValidator());
        }
    }

    public class SerialConnectionSettingsValidator : AbstractValidator<SerialConnectionSettingsDto>
    {
        public SerialConnectionSettingsValidator()
        {
            RuleFor(x => x.BaudRate)
                .GreaterThan(0).WithMessage("Baud rate must be a positive integer.")
                .Must(rate => rate is 9600 or 19200 or 38400 or 57600 or 115200)
                .WithMessage("Baud rate should be one of: 9600, 19200, 38400, 57600, or 115200.");
        }
    }

    public class TcpConnectionSettingsValidator : AbstractValidator<TcpConnectionSettingsDto>
    {
        public TcpConnectionSettingsValidator()
        {
            RuleFor(x => x.Port)
                .InclusiveBetween(1, 65535).WithMessage("TCP port must be between 1 and 65535.");

            RuleFor(x => x.ConnectionTimeoutMs)
                .GreaterThan(0).WithMessage("Connection timeout must be a positive integer (milliseconds).");

            RuleFor(x => x.ReadTimeoutMs)
                .GreaterThan(0).WithMessage("Read timeout must be a positive integer (milliseconds).");

            RuleFor(x => x.WriteTimeoutMs)
                .GreaterThan(0).WithMessage("Write timeout must be a positive integer (milliseconds).");
        }
    }

    public class PlayerSettingsValidator : AbstractValidator<PlayerSettingsDto>
    {
        public PlayerSettingsValidator()
        {
            RuleFor(x => x.StartupFilter)
                .IsInEnum().WithMessage("Startup filter must be a valid TeensyFilterType enum value.");
        }
    }

    public class VideoSettingsValidator : AbstractValidator<VideoSettingsDto>
    {
        public VideoSettingsValidator()
        {
            // EnableVideo is bool with [Required] - no additional validation needed for MVP
            // Future properties (quality, resolution, etc.) would add rules here
        }
    }

    public class FileTransferSettingsValidator : AbstractValidator<FileTransferSettingsDto>
    {
        public FileTransferSettingsValidator()
        {
            RuleFor(x => x.WatchDirectoryLocation)
                .Must(path => string.IsNullOrEmpty(path) || Path.IsPathFullyQualified(path))
                .WithMessage("Watch directory location must be empty or a valid absolute directory path.");

            RuleFor(x => x.AutoTransferPath)
                .NotNull().WithMessage("Auto transfer path is required.");
        }
    }

    public class SearchSettingsValidator : AbstractValidator<SearchSettingsDto>
    {
        public SearchSettingsValidator()
        {
            RuleFor(x => x.SearchWeights)
                .NotNull().WithMessage("Search weights are required.")
                .SetValidator(new SearchWeightsValidator());

            RuleFor(x => x.SearchStopWords)
                .NotNull().WithMessage("Search stop words list is required.");

            RuleFor(x => x.BannedDirectories)
                .NotNull().WithMessage("Banned directories list is required.");

            RuleFor(x => x.BannedFiles)
                .NotNull().WithMessage("Banned files list is required.");
        }
    }

    public class SearchWeightsValidator : AbstractValidator<SearchWeightsDto>
    {
        public SearchWeightsValidator()
        {
            RuleFor(x => x.Title)
                .GreaterThanOrEqualTo(0).WithMessage("Title weight must be greater than or equal to 0.");

            RuleFor(x => x.FileName)
                .GreaterThanOrEqualTo(0).WithMessage("File name weight must be greater than or equal to 0.");

            RuleFor(x => x.FilePath)
                .GreaterThanOrEqualTo(0).WithMessage("File path weight must be greater than or equal to 0.");

            RuleFor(x => x.Creator)
                .GreaterThanOrEqualTo(0).WithMessage("Creator weight must be greater than or equal to 0.");

            RuleFor(x => x.Description)
                .GreaterThanOrEqualTo(0).WithMessage("Description weight must be greater than or equal to 0.");

            RuleFor(x => x)
                .Must(weights => weights.Title > 0 || weights.FileName > 0 || weights.FilePath > 0 ||
                                 weights.Creator > 0 || weights.Description > 0)
                .WithMessage("At least one search weight must be greater than 0 for meaningful search.");
        }
    }

    public class AppSettingsValidator : AbstractValidator<AppSettingsDto>
    {
        public AppSettingsValidator()
        {
            // No validation rules needed for boolean FirstTimeSetup
        }
    }
}
