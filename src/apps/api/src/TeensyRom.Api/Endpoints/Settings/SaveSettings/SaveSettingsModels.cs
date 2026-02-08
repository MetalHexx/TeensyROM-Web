using System.ComponentModel.DataAnnotations;

namespace TeensyRom.Api.Endpoints.Settings.SaveSettings
{
    /// <summary>
    /// Request model for saving all TeensyROM user settings.
    /// </summary>
    public record SaveSettingsRequest
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
            RuleFor(x => x.KnownDevices)
                .NotNull().WithMessage("Known devices list is required.");
            
            RuleForEach(x => x.KnownDevices)
                .SetValidator(new DeviceSettingsValidator());

            RuleFor(x => x.PlayerSettings)
                .NotNull().WithMessage("Player settings are required.")
                .SetValidator(new PlayerSettingsValidator());

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

    public class DeviceSettingsValidator : AbstractValidator<DeviceSettingsDto>
    {
        public DeviceSettingsValidator()
        {
            RuleFor(x => x.DeviceId)
                .NotEmpty().WithMessage("Device ID is required.");

            RuleFor(x => x.VideoSettings)
                .NotNull().WithMessage("Video settings are required for each device.")
                .SetValidator(new VideoSettingsValidator());
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
