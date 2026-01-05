using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Music;

namespace TeensyRom.Core.Serial.Commands.Composite.EndSeek
{
    public class EndSeekCommand : ITeensyCommand<EndSeekResult>
    {
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
        public required bool ShouldEnableVoices { get; init; }
        public required double SeekSpeed { get; init; }
        public required MusicSpeedCurveTypes SpeedCurve { get; init; }
    }
}
