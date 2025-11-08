using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands.MuteSidVoices;
using TeensyRom.Core.Music;

namespace TeensyRom.Core.Serial.Commands.Composite.EndSeek
{
    public class EndSeekCommand : ITeensyCommand<EndSeekResult>
    {
        public string? DeviceId { get; set; }
        public ISerialStateContext Serial { get; set; } = null!;
        public bool ShouldEnableVoices { get; set; } = false;
        public double SeekSpeed { get; set; }
        public MusicSpeedCurveTypes SpeedCurve { get; set; }
    }
}
