using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Core.Serial
{
    /// <summary>
    /// The parsed contents of a firmware version reply. Every field defaults to its "absent" value,
    /// so a reply that fails to parse still yields a well-formed, inspectable result.
    /// </summary>
    public sealed record VersionReply
    {
        /// <summary>True iff the FW line parsed (a recognizable label plus a version).</summary>
        public bool IsTeensyRom { get; init; }
        public HardwareVariant HardwareVariant { get; init; } = HardwareVariant.Unknown;
        public Version? FirmwareVersion { get; init; }
        /// <summary>
        /// What the build added after the version number: "-pr65" for a tagged build, "*" for a build from a
        /// dirty tree, "-pr65*" for both. Empty on a release build. Display only: compatibility reads
        /// <see cref="FirmwareVersion"/>.
        /// </summary>
        public string VersionSuffix { get; init; } = string.Empty;
        /// <summary>The whole version as the firmware reports it, such as "0.9-pr65*"; empty when the reply has no version.</summary>
        public string FirmwareVersionText => FirmwareVersion is null ? string.Empty : $"{FirmwareVersion}{VersionSuffix}";
        public bool IsMinimalFirmware { get; init; }
        public string BuildTimestamp { get; init; } = string.Empty;
        public int? CpuMhz { get; init; }
        public decimal? TemperatureC { get; init; }
        /// <summary>Digits exactly as reported; null when absent.</summary>
        public string? ChipId { get; init; }
        public MachineType Machine { get; init; } = MachineType.Unknown;
        public VideoStandard VideoStandard { get; init; } = VideoStandard.Unknown;
        public int? TodClockHz { get; init; }
        /// <summary>
        /// The firmware's "Boot:" line: true once the C64 menu has finished booting ("complete"), false
        /// while it is still booting ("in progress"), null when the reply has no such line - every
        /// minimal-image reply, or a reply cut short.
        /// </summary>
        public bool? BootComplete { get; init; }
        /// <summary>Sanitized copy of the raw reply text, for logging.</summary>
        public string RawText { get; init; } = string.Empty;
        public static VersionReply Empty { get; } = new();
    }
}
