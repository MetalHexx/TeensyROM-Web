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
        public required bool ShouldEnableVoices { get; init; }
        public required double OriginalSpeed { get; init; }
        public required MusicSpeedCurveTypes SpeedCurve { get; init; }
    }
}
