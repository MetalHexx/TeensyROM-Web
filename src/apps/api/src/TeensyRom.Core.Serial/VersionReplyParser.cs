using System.Globalization;
using System.Text.RegularExpressions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Core.Serial
{
    /// <summary>
    /// Parses the firmware's version-info reply into a <see cref="VersionReply"/>. Pure and defensive:
    /// the text originates from a serial peer, so the input is bounded, every pattern is anchored where
    /// the shape allows it, and a malformed or partial reply never throws.
    /// </summary>
    public static class VersionReplyParser
    {
        private const int MaxInputLength = 4096;

        // "FW:" label followed, anywhere later on the line, by a version token. The text between the
        // label and the version is the hardware variant.
        private static readonly Regex FwLabeledLineRegex = new(
            @"FW:\s*(?<variant>[^\r\n]*?)\s*v(?<version>\d+(?:\.\d+){1,3})",
            RegexOptions.NonBacktracking);

        // Pre-0.7.2.8 layout: the version sits on an unlabeled first line, e.g. "TeensyROM+ v0.7.2.7".
        private static readonly Regex FwUnlabeledLineRegex = new(
            @"^(?<variant>TeensyROM\+?)\s+v(?<version>\d+(?:\.\d+){1,3})",
            RegexOptions.NonBacktracking);

        private static readonly Regex MinimalRegex = new(
            @"\(minimal\)", RegexOptions.NonBacktracking | RegexOptions.IgnoreCase);

        private static readonly Regex CpuMhzRegex = new(
            @"(?<mhz>\d+)MHz", RegexOptions.NonBacktracking);

        private static readonly Regex TemperatureRegex = new(
            @"(?<temp>-?\d+(?:\.\d+)?)C", RegexOptions.NonBacktracking);

        // Bounded to at most 16 digits: a real chip ID is at most 8. The trailing \b (not a lookahead —
        // lookarounds aren't supported under NonBacktracking) is what makes a run of more than 16 digits
        // fail to match, rather than silently truncating to its first 16.
        private static readonly Regex ChipIdRegex = new(
            @"UID:\s*(?<uid>\d{1,16})\b", RegexOptions.NonBacktracking);

        private static readonly Regex MachineLineRegex = new(
            @"^C(?<machine>64|128)\s+(?<video>NTSC|PAL)\s+Vid\s+(?<tod>\d{1,3})\s+Hz$",
            RegexOptions.NonBacktracking);

        private static readonly Regex BootLineRegex = new(
            @"^Boot:\s*(?<state>complete|in progress)$", RegexOptions.NonBacktracking);

        private static readonly Regex BuildLabelStripRegex = new(
            @"^FW:\s*", RegexOptions.NonBacktracking);

        private static readonly Regex BuildLineRegex = new(
            @"^[A-Za-z]{3}\s+\d{1,2}\s+\d{4},\s+\d{2}:\d{2}:\d{2}$",
            RegexOptions.NonBacktracking);

        private static readonly Regex WhitespaceCollapseRegex = new(
            @"\s+", RegexOptions.NonBacktracking);

        public static readonly Version FullFirmwareFloor = new(0, 8, 0, 9);
        public static readonly Version MinimalFirmwareFloor = new(0, 0, 2);

        public static VersionReply Parse(string? replyText)
        {
            var rawText = (replyText ?? string.Empty).SanitizeForLogging() ?? string.Empty;

            try
            {
                var text = replyText ?? string.Empty;
                if (text.Length > MaxInputLength)
                {
                    text = text[..MaxInputLength];
                }

                var lines = text
                    .Split(['\r', '\n'])
                    .Select(line => line.Trim())
                    .Where(line => line.Length > 0)
                    .ToList();

                var (isTeensyRom, hardwareVariant, firmwareVersion, isMinimal) = ParseFwLine(lines);
                var (cpuMhz, temperatureC, chipId) = ParseTeensyLine(lines);
                var (machine, videoStandard, todClockHz) = ParseMachineLine(lines);
                var buildTimestamp = ParseBuildLine(lines);
                var bootComplete = ParseBootLine(lines);

                return new VersionReply
                {
                    IsTeensyRom = isTeensyRom,
                    HardwareVariant = hardwareVariant,
                    FirmwareVersion = firmwareVersion,
                    IsMinimalFirmware = isMinimal,
                    BuildTimestamp = buildTimestamp,
                    CpuMhz = cpuMhz,
                    TemperatureC = temperatureC,
                    ChipId = chipId,
                    Machine = machine,
                    VideoStandard = videoStandard,
                    TodClockHz = todClockHz,
                    BootComplete = bootComplete,
                    RawText = rawText
                };
            }
            catch (Exception)
            {
                return VersionReply.Empty with { RawText = rawText };
            }
        }

        public static bool IsCompatible(VersionReply reply)
        {
            if (!reply.IsTeensyRom || reply.FirmwareVersion is null)
            {
                return false;
            }

            var floor = reply.IsMinimalFirmware ? MinimalFirmwareFloor : FullFirmwareFloor;
            return reply.FirmwareVersion >= floor;
        }

        private static (bool IsTeensyRom, HardwareVariant Variant, Version? Version, bool IsMinimal) ParseFwLine(List<string> lines)
        {
            foreach (var line in lines)
            {
                var match = FwLabeledLineRegex.Match(line);
                if (match.Success)
                {
                    return BuildFwResult(line, match);
                }
            }

            foreach (var line in lines)
            {
                var match = FwUnlabeledLineRegex.Match(line);
                if (match.Success)
                {
                    return BuildFwResult(line, match);
                }
            }

            return (false, HardwareVariant.Unknown, null, false);
        }

        private static (bool IsTeensyRom, HardwareVariant Variant, Version? Version, bool IsMinimal) BuildFwResult(string line, Match match)
        {
            if (!Version.TryParse(match.Groups["version"].Value, out var version))
            {
                return (false, HardwareVariant.Unknown, null, false);
            }

            var variant = match.Groups["variant"].Value.Trim() switch
            {
                "TeensyROM+" => HardwareVariant.TeensyRomPlus,
                "TeensyROM" => HardwareVariant.TeensyRom,
                _ => HardwareVariant.Unknown
            };

            return (true, variant, version, MinimalRegex.IsMatch(line));
        }

        private static (int? CpuMhz, decimal? TemperatureC, string? ChipId) ParseTeensyLine(List<string> lines)
        {
            var line = lines.FirstOrDefault(l => l.StartsWith("Teensy:", StringComparison.Ordinal));
            if (line is null)
            {
                return (null, null, null);
            }

            int? cpuMhz = null;
            var mhzMatch = CpuMhzRegex.Match(line);
            if (mhzMatch.Success)
            {
                cpuMhz = int.Parse(mhzMatch.Groups["mhz"].Value, CultureInfo.InvariantCulture);
            }

            decimal? temperatureC = null;
            var tempMatch = TemperatureRegex.Match(line);
            if (tempMatch.Success)
            {
                temperatureC = decimal.Parse(tempMatch.Groups["temp"].Value, CultureInfo.InvariantCulture);
            }

            string? chipId = null;
            var uidMatch = ChipIdRegex.Match(line);
            if (uidMatch.Success)
            {
                chipId = uidMatch.Groups["uid"].Value;
            }

            return (cpuMhz, temperatureC, chipId);
        }

        private static (MachineType Machine, VideoStandard VideoStandard, int? TodClockHz) ParseMachineLine(List<string> lines)
        {
            foreach (var line in lines)
            {
                var match = MachineLineRegex.Match(line);
                if (!match.Success)
                {
                    continue;
                }

                var machine = match.Groups["machine"].Value == "64" ? MachineType.C64 : MachineType.C128;
                var video = match.Groups["video"].Value == "NTSC" ? VideoStandard.NTSC : VideoStandard.PAL;
                var tod = int.Parse(match.Groups["tod"].Value, CultureInfo.InvariantCulture);
                return (machine, video, tod);
            }

            return (MachineType.Unknown, VideoStandard.Unknown, null);
        }

        /// <summary>The last "Boot:" line wins: a reply that ran into the next one carries the newer state last.</summary>
        private static bool? ParseBootLine(List<string> lines)
        {
            bool? bootComplete = null;

            foreach (var line in lines)
            {
                var match = BootLineRegex.Match(line);
                if (match.Success)
                {
                    bootComplete = match.Groups["state"].Value == "complete";
                }
            }

            return bootComplete;
        }

        private static string ParseBuildLine(List<string> lines)
        {
            foreach (var line in lines)
            {
                var stripped = BuildLabelStripRegex.Replace(line, string.Empty);
                if (!BuildLineRegex.IsMatch(stripped))
                {
                    continue;
                }

                return WhitespaceCollapseRegex.Replace(stripped, " ").Trim();
            }

            return string.Empty;
        }
    }
}
