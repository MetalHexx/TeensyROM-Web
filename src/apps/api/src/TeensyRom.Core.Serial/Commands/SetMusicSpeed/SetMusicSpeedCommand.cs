using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Music;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands;

namespace TeensyRom.Core.Commands.SetMusicSpeed
{
    public class SetMusicSpeedCommand(double speed, MusicSpeedCurveTypes type) : ITeensyCommand<SetMusicSpeedResult>
    {
        public string? DeviceId { get; set; }
        public ISerialStateContext Serial { get; set; } = null!;
        public double Speed { get; } = speed;
        public MusicSpeedCurveTypes Type { get; } = type;
    }
}
