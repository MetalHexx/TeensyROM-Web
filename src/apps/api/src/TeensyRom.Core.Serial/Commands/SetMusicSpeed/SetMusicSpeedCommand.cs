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
    public class SetMusicSpeedCommand : ITeensyCommand<SetMusicSpeedResult>
    {
        public string? DeviceId { get; set; }
        public ISerialStateContext Serial { get; set; } = null!;
        public required double Speed { get; init; }
        public required MusicSpeedCurveTypes Type { get; init; }
    }
}
