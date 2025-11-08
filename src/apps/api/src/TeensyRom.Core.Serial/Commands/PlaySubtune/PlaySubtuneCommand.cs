using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Serial.Commands;

namespace TeensyRom.Core.Commands.PlaySubtune
{
    public class PlaySubtuneCommand (int subtuneIndex) : ITeensyCommand<PlaySubtuneResult>
    {
        public string? DeviceId { get; set; }
        public ISerialStateContext Serial { get; set; } = null!;
        public int SubtuneIndex { get; } = subtuneIndex;
    }
}
