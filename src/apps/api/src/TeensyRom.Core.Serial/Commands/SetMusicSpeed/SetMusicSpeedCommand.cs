using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Music;
using TeensyRom.Core.Serial.Commands;

namespace TeensyRom.Core.Commands.SetMusicSpeed
{
    public class SetMusicSpeedCommand : ITeensyCommand<SetMusicSpeedResult>
    {
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
        public required double Speed { get; init; }
        public required MusicSpeedCurveTypes Type { get; init; }
    }
}
