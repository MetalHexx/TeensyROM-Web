using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Core.Serial.Tests.Unit
{
    public class VersionReplyParserTests
    {
        private const string FullReply =
            "\n  FW: TeensyROM+ v0.8.0.9\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  59.1C  UID: 19307720\r\n  C128  NTSC Vid  60 Hz\n";

        private const string MinimalReply =
            "\n  FW: TeensyROM+ v0.8.0.9(minimal)\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  59.1C  UID: 19307720\r\n";

        private const string PreLabeledReply =
            "\nTeensyROM+ v0.7.2.7\n     FW: Jul 27 2026, 09:41:32\r\n       Teensy: 816MHz  59.1C\r\n";

        [Fact]
        public void Parse_FullReply_ParsesAllFieldsAndIsCompatible()
        {
            var reply = VersionReplyParser.Parse(FullReply);

            reply.IsTeensyRom.Should().BeTrue();
            reply.HardwareVariant.Should().Be(HardwareVariant.TeensyRomPlus);
            reply.FirmwareVersion.Should().Be(new Version(0, 8, 0, 9));
            reply.IsMinimalFirmware.Should().BeFalse();
            reply.BuildTimestamp.Should().Be("Sep 18 2026, 09:41:32");
            reply.CpuMhz.Should().Be(816);
            reply.TemperatureC.Should().Be(59.1m);
            reply.ChipId.Should().Be("19307720");
            reply.Machine.Should().Be(MachineType.C128);
            reply.VideoStandard.Should().Be(VideoStandard.NTSC);
            reply.TodClockHz.Should().Be(60);
            VersionReplyParser.IsCompatible(reply).Should().BeTrue();
        }

        [Fact]
        public void Parse_MinimalReply_ParsesMinimalFlagAndIsCompatible()
        {
            var reply = VersionReplyParser.Parse(MinimalReply);

            reply.IsTeensyRom.Should().BeTrue();
            reply.IsMinimalFirmware.Should().BeTrue();
            reply.Machine.Should().Be(MachineType.Unknown);
            reply.VideoStandard.Should().Be(VideoStandard.Unknown);
            reply.TodClockHz.Should().BeNull();
            VersionReplyParser.IsCompatible(reply).Should().BeTrue();
        }

        [Fact]
        public void Parse_Full0_7_2_10Reply_ParsesChipIdAndIsIncompatible()
        {
            const string reply072 =
                "\n  FW: TeensyROM+ v0.7.2.10\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  59.1C  UID: 12345678\r\n";

            var reply = VersionReplyParser.Parse(reply072);

            reply.IsTeensyRom.Should().BeTrue();
            reply.FirmwareVersion.Should().Be(new Version(0, 7, 2, 10));
            reply.ChipId.Should().Be("12345678");
            VersionReplyParser.IsCompatible(reply).Should().BeFalse();
        }

        [Fact]
        public void Parse_PreLabeledLegacyReply_ParsesUnlabeledVersionLine()
        {
            var reply = VersionReplyParser.Parse(PreLabeledReply);

            reply.IsTeensyRom.Should().BeTrue();
            reply.HardwareVariant.Should().Be(HardwareVariant.TeensyRomPlus);
            reply.FirmwareVersion.Should().Be(new Version(0, 7, 2, 7));
            reply.BuildTimestamp.Should().Be("Jul 27 2026, 09:41:32");
            reply.CpuMhz.Should().Be(816);
            reply.ChipId.Should().BeNull();
            VersionReplyParser.IsCompatible(reply).Should().BeFalse();
        }

        [Theory]
        [InlineData("v0.9", "0.9", "")]
        [InlineData("v0.9*", "0.9", "*")]
        [InlineData("v0.9-pr65", "0.9", "-pr65")]
        [InlineData("v0.9-pr65*", "0.9", "-pr65*")]
        [InlineData("v0.8.0.9-rc.1", "0.8.0.9", "-rc.1")]
        [InlineData("v0.9-1.2.3", "0.9", "-1.2.3")]
        [InlineData("v0.9-v2.0.0*", "0.9", "-v2.0.0*")]
        [InlineData("v0.9-busy", "0.9", "-busy")]
        [InlineData("v0.9-minimal", "0.9", "-minimal")]
        public void Parse_TaggedOrDirtyBuild_KeepsTheSuffixAndStaysCompatible(string token, string number, string suffix)
        {
            var parsed = VersionReplyParser.Parse(
                $"\n  FW: TeensyROM+ {token}\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  59.1C  UID: 19307720\r\n  C128  NTSC Vid  60 Hz\n");

            parsed.IsTeensyRom.Should().BeTrue();
            parsed.HardwareVariant.Should().Be(HardwareVariant.TeensyRomPlus);
            parsed.FirmwareVersion.Should().Be(Version.Parse(number));
            parsed.VersionSuffix.Should().Be(suffix);
            parsed.FirmwareVersionText.Should().Be(token[1..]);
            parsed.IsMinimalFirmware.Should().BeFalse();
            parsed.BuildTimestamp.Should().Be("Sep 18 2026, 09:41:32");
            parsed.ChipId.Should().Be("19307720");
            VersionReplyParser.IsCompatible(parsed).Should().BeTrue();
        }

        [Theory]
        [InlineData("v0.9(minimal)", "0.9", "")]
        [InlineData("v0.9*(minimal)", "0.9", "*")]
        [InlineData("v0.9-pr65*(minimal)", "0.9", "-pr65*")]
        [InlineData("v0.9-minimal(minimal)", "0.9", "-minimal")]
        public void Parse_TaggedOrDirtyMinimalBuild_StopsTheSuffixAtTheMinimalMarker(string token, string number, string suffix)
        {
            var parsed = VersionReplyParser.Parse(
                $"\n  FW: TeensyROM+ {token}\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  59.1C  UID: 19307720\r\n");

            parsed.IsMinimalFirmware.Should().BeTrue();
            parsed.FirmwareVersion.Should().Be(Version.Parse(number));
            parsed.VersionSuffix.Should().Be(suffix);
            VersionReplyParser.IsCompatible(parsed).Should().BeTrue();
        }

        [Fact]
        public void Parse_ATagNamedMinimal_IsNotAMinimalBuild()
        {
            var parsed = VersionReplyParser.Parse("FW: TeensyROM+ v0.9-minimal\r\n");

            parsed.IsMinimalFirmware.Should().BeFalse();
        }

        [Fact]
        public void Parse_TheLongestTagTheBannerFits_KeepsTheChipIdAndTheWholeTag()
        {
            // "TeensyROM+ v0.9-" and the "*" leave 23 of the firmware's 40 columns for the tag.
            var tag = new string('W', 23);

            var parsed = VersionReplyParser.Parse(
                $"\n  FW: TeensyROM+ v0.9-{tag}*\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  59.1C  UID: 19307720\r\n  C128  NTSC Vid  60 Hz\n");

            parsed.FirmwareVersionText.Should().Be($"0.9-{tag}*");
            parsed.ChipId.Should().Be("19307720");
        }

        [Theory]
        [InlineData("v0.9trailer")]
        [InlineData("v0.9_bad")]
        [InlineData("v0.9 -pr65")]
        public void Parse_TextThatIsNotASuffix_LeavesTheVersionAlone(string token)
        {
            var parsed = VersionReplyParser.Parse($"FW: TeensyROM+ {token}\r\n");

            parsed.FirmwareVersion.Should().Be(new Version(0, 9));
            parsed.VersionSuffix.Should().BeEmpty();
            parsed.FirmwareVersionText.Should().Be("0.9");
        }

        [Fact]
        public void Parse_PreLabeledLegacyReply_HasNoSuffix()
        {
            var parsed = VersionReplyParser.Parse(PreLabeledReply);

            parsed.VersionSuffix.Should().BeEmpty();
            parsed.FirmwareVersionText.Should().Be("0.7.2.7");
        }

        [Fact]
        public void Parse_ReleaseReply_ReadsExactlyAsItDidBefore()
        {
            VersionReplyParser.Parse(FullReply).FirmwareVersionText.Should().Be("0.8.0.9");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("garbage")]
        public void Parse_AReplyWithNoVersion_HasEmptyVersionText(string? text)
        {
            var parsed = VersionReplyParser.Parse(text);

            parsed.VersionSuffix.Should().BeEmpty();
            parsed.FirmwareVersionText.Should().BeEmpty();
        }

        [Fact]
        public void IsCompatible_ATagDoesNotRaiseAVersionBelowTheFloor()
        {
            var parsed = VersionReplyParser.Parse("FW: TeensyROM+ v0.8.0.8-pr65*\r\n");

            parsed.FirmwareVersion.Should().Be(new Version(0, 8, 0, 8));
            VersionReplyParser.IsCompatible(parsed).Should().BeFalse();
        }

        [Fact]
        public void Parse_FullReplyWithZeroHzLine_MachineFieldsAreUnknown()
        {
            const string reply =
                "\n  FW: TeensyROM+ v0.8.0.9\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  59.1C  UID: 19307720\r\n  0 Hz\n";

            var parsed = VersionReplyParser.Parse(reply);

            parsed.IsTeensyRom.Should().BeTrue();
            parsed.HardwareVariant.Should().Be(HardwareVariant.TeensyRomPlus);
            parsed.FirmwareVersion.Should().Be(new Version(0, 8, 0, 9));
            parsed.CpuMhz.Should().Be(816);
            parsed.ChipId.Should().Be("19307720");
            parsed.Machine.Should().Be(MachineType.Unknown);
            parsed.VideoStandard.Should().Be(VideoStandard.Unknown);
            parsed.TodClockHz.Should().BeNull();
        }

        [Fact]
        public void Parse_FullReplyWithExtraStorageLine_ParsesSameAsFullReply()
        {
            const string reply =
                "\n  FW: TeensyROM+ v0.8.0.9\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  59.1C  UID: 19307720\r\n  SD: 1  USB: 0\r\n  C128  NTSC Vid  60 Hz\n";

            var parsed = VersionReplyParser.Parse(reply);
            var expected = VersionReplyParser.Parse(FullReply);

            parsed.Should().BeEquivalentTo(expected, options => options.Excluding(r => r.RawText));
        }

        [Theory]
        [InlineData("  Boot: complete\n", true)]
        [InlineData("  Boot: in progress\n", false)]
        [InlineData("", null)]
        public void Parse_BootLine_ReportsTheMenuBootState(string bootLine, bool? expected)
        {
            var parsed = VersionReplyParser.Parse(FullReply + bootLine);

            parsed.BootComplete.Should().Be(expected);
            parsed.ChipId.Should().Be("19307720");
        }

        [Fact]
        public void Parse_TwoBootLines_TheLastOneWins()
        {
            var parsed = VersionReplyParser.Parse(FullReply + "  Boot: in progress\n" + FullReply + "  Boot: complete\n");

            parsed.BootComplete.Should().BeTrue();
        }

        [Fact]
        public void Parse_MinimalReply_HasNoBootState()
        {
            VersionReplyParser.Parse(MinimalReply).BootComplete.Should().BeNull();
        }

        [Fact]
        public void Parse_Null_ReturnsNotTeensyRomWithoutThrowing()
        {
            var reply = VersionReplyParser.Parse(null);

            reply.IsTeensyRom.Should().BeFalse();
            reply.RawText.Should().NotBeNull();
        }

        [Fact]
        public void Parse_Empty_ReturnsNotTeensyRomWithoutThrowing()
        {
            var reply = VersionReplyParser.Parse(string.Empty);

            reply.IsTeensyRom.Should().BeFalse();
            reply.RawText.Should().NotBeNull();
        }

        [Fact]
        public void Parse_Garbage_ReturnsNotTeensyRomWithoutThrowing()
        {
            var reply = VersionReplyParser.Parse("\x00\xFF garbage");

            reply.IsTeensyRom.Should().BeFalse();
            reply.RawText.Should().NotBeNull();
        }

        [Fact]
        public void Parse_TruncatedFullReply_DoesNotThrow()
        {
            var truncated = FullReply[..(FullReply.Length - 6)];

            var reply = VersionReplyParser.Parse(truncated);

            reply.RawText.Should().NotBeNull();
        }

        [Fact]
        public void Parse_NonPlusVariant_ParsesTeensyRomVariant()
        {
            const string reply =
                "\n  FW: TeensyROM v0.8.0.9\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  59.1C  UID: 19307720\r\n  C128  NTSC Vid  60 Hz\n";

            var parsed = VersionReplyParser.Parse(reply);

            parsed.HardwareVariant.Should().Be(HardwareVariant.TeensyRom);
        }

        [Fact]
        public void Parse_MachineLineWithPalAndC64_ParsesMachineFields()
        {
            const string reply =
                "\n  FW: TeensyROM+ v0.8.0.9\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  59.1C  UID: 19307720\r\n  C64  PAL Vid  50 Hz\n";

            var parsed = VersionReplyParser.Parse(reply);

            parsed.Machine.Should().Be(MachineType.C64);
            parsed.VideoStandard.Should().Be(VideoStandard.PAL);
            parsed.TodClockHz.Should().Be(50);
        }

        [Fact]
        public void Parse_SingleDigitBuildDayWithDoubleSpace_CollapsesWhitespace()
        {
            const string reply =
                "\n  FW: TeensyROM+ v0.8.0.9\r\n      Sep  8 2026, 09:41:32\r\n  Teensy: 816MHz  59.1C  UID: 19307720\r\n  C128  NTSC Vid  60 Hz\n";

            var parsed = VersionReplyParser.Parse(reply);

            parsed.BuildTimestamp.Should().Be("Sep 8 2026, 09:41:32");
        }

        [Fact]
        public void Parse_TeensyLineWithNegativeTemperature_ParsesTemperature()
        {
            const string reply =
                "\n  FW: TeensyROM+ v0.8.0.9\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  -5.2C  UID: 19307720\r\n  C128  NTSC Vid  60 Hz\n";

            var parsed = VersionReplyParser.Parse(reply);

            parsed.TemperatureC.Should().Be(-5.2m);
        }

        [Fact]
        public void Parse_TeensyLineWithIntegerTemperature_ParsesTemperature()
        {
            const string reply =
                "\n  FW: TeensyROM+ v0.8.0.9\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  60C  UID: 19307720\r\n  C128  NTSC Vid  60 Hz\n";

            var parsed = VersionReplyParser.Parse(reply);

            parsed.TemperatureC.Should().Be(60m);
        }

        [Fact]
        public void Parse_ChipIdWithTwentyDigits_ReturnsNullChipId()
        {
            const string reply =
                "\n  FW: TeensyROM+ v0.8.0.9\r\n      Sep 18 2026, 09:41:32\r\n  Teensy: 816MHz  59.1C  UID: 12345678901234567890\r\n  C128  NTSC Vid  60 Hz\n";

            var parsed = VersionReplyParser.Parse(reply);

            parsed.ChipId.Should().BeNull();
        }

        [Fact]
        public void IsCompatible_FullVersionAtFloor_ReturnsTrue()
        {
            var reply = new VersionReply { IsTeensyRom = true, FirmwareVersion = new Version(0, 8, 0, 9) };

            VersionReplyParser.IsCompatible(reply).Should().BeTrue();
        }

        [Fact]
        public void IsCompatible_FullVersionOneBelowFloor_ReturnsFalse()
        {
            var reply = new VersionReply { IsTeensyRom = true, FirmwareVersion = new Version(0, 8, 0, 8) };

            VersionReplyParser.IsCompatible(reply).Should().BeFalse();
        }

        [Fact]
        public void IsCompatible_ThreePartVersionBelowFourPartFloor_ReturnsFalse()
        {
            var reply = new VersionReply { IsTeensyRom = true, FirmwareVersion = new Version(0, 8, 0) };

            VersionReplyParser.IsCompatible(reply).Should().BeFalse();
        }

        [Fact]
        public void VersionInfoToken_Value_MatchesFirmwareToken()
        {
            TeensyToken.VersionInfo.Value.Should().Be((ushort)0x6476);
        }
    }
}
