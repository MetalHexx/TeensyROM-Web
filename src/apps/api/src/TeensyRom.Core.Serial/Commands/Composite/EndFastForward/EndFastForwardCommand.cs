using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands.MuteSidVoices;
using TeensyRom.Core.Music;

namespace TeensyRom.Core.Serial.Commands.Composite.EndFastForward
{
    public class EndFastForwardCommand : ITeensyCommand<EndFastForwardResult>
    {
        public string? DeviceId { get; set; }
        public ISerialStateContext Serial { get; set; } = null!;
        public bool ShouldEnableVoices { get; set; } = false;
        public double OriginalSpeed { get; set; }
        public MusicSpeedCurveTypes SpeedCurve { get; set; }
    }
}
