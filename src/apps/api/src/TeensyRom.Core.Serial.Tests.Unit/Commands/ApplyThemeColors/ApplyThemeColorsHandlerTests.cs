using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Serial.Commands.Composite.ApplyThemeColors;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Tests.Unit.Routines;
using TeensyRom.Core.Themes;

namespace TeensyRom.Core.Serial.Tests.Unit.Commands.ApplyThemeColors
{
    public class ApplyThemeColorsHandlerTests
    {
        private const string VersionText =
            "\n  FW: TeensyROM+ v0.8.0.11\r\n      Sep 23 2026, 22:45:10\r\n  Teensy: 816MHz  59.1C  UID: 19307720\r\n  C64  PAL Vid  50 Hz\n";

        private static readonly DeviceThemePart Colors = new()
        {
            Background = 1, Border = 2, Banner = 3, Time = 4, Option = 5, Sources = 6, Name = 7
        };

        private static readonly byte[] SevenFrames =
        [
            0x64, 0x22, 0, 1, 0x64, 0x22, 1, 2, 0x64, 0x22, 2, 3, 0x64, 0x22, 3, 4,
            0x64, 0x22, 4, 5, 0x64, 0x22, 5, 6, 0x64, 0x22, 6, 7
        ];

        private readonly ILoggingService _log = Substitute.For<ILoggingService>();
        private readonly ConnectionOptions _options = new();
        private readonly IDeviceConnectionManager _devices = Substitute.For<IDeviceConnectionManager>();

        private ApplyThemeColorsHandler Handler() => new(_log, _options, _devices);

        private static ApplyThemeColorsCommand CommandOn(ScriptedCommunicationPort port) =>
            new() { DeviceId = "device-1", CommunicationPort = port, Colors = Colors };

        private static ScriptedCommunicationPort PortAcknowledging(int colors)
        {
            var port = new ScriptedCommunicationPort();
            for (var i = 0; i < colors; i++)
            {
                port.NewSegment().EnqueueToken(TeensyToken.Ack);
            }
            return port;
        }

        [Fact]
        public async Task Handle_MenuComesBack_SendsSevenColorsInOrderThenTheResetAndSucceeds()
        {
            var port = PortAcknowledging(7);
            port.EnqueueTokenAfterQuiet(650, TeensyToken.GoodSIDToken);
            port.NewSegment();
            port.NewSegment().EnqueueToken(TeensyToken.Ack).EnqueueText($"{VersionText}  Boot: complete\n");

            var result = await Handler().Handle(CommandOn(port), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            port.Written.Take(SevenFrames.Length + 2).Should().Equal(SevenFrames.Concat(new byte[] { 0x64, 0xEE }));
        }

        [Fact]
        public async Task Handle_FailOnTheThirdColor_StopsThereWithoutAReset()
        {
            var port = PortAcknowledging(2);
            port.NewSegment().EnqueueToken(TeensyToken.Fail);

            var result = await Handler().Handle(CommandOn(port), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            result.Error.Should().NotBeNullOrWhiteSpace();
            port.Written.Should().Equal(SevenFrames.Take(12));
        }

        [Fact]
        public async Task Handle_MenuNeverBoots_ReportsThatItDidNotComeBack()
        {
            var port = PortAcknowledging(7);

            var result = await Handler().Handle(CommandOn(port), CancellationToken.None);

            result.IsSuccess.Should().BeFalse();
            result.Error.Should().Contain("did not come back");
        }

        [Fact]
        public async Task Handle_MenuStillBooting_SucceedsAndMarksTheBootPending()
        {
            _options.MenuBootTimeoutMs = 300;
            var port = PortAcknowledging(7);
            port.EnqueueTokenAfterQuiet(0, TeensyToken.GoodSIDToken);
            port.NewSegment();
            port.NewSegment().EnqueueToken(TeensyToken.Ack).EnqueueText($"{VersionText}  Boot: in progress\n");

            var result = await Handler().Handle(CommandOn(port), CancellationToken.None);

            result.IsSuccess.Should().BeTrue();
            _devices.Received(1).GetAvailableDevice("device-1");
        }
    }
}
