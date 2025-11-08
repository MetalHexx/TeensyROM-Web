using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Serial.Commands;

namespace TeensyRom.Core.Commands.PlaySubtune
{
    public class PlaySubtuneCommand : ITeensyCommand<PlaySubtuneResult>
    {
        public string? DeviceId { get; set; }
        public required ISerialStateContext Serial { get; init; }
        public required int SubtuneIndex { get; init; }
    }
}
