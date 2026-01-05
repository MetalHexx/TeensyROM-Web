using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Serial.Commands;

namespace TeensyRom.Core.Commands.PlaySubtune
{
    public class PlaySubtuneCommand : ITeensyCommand<PlaySubtuneResult>
    {
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
        public required int SubtuneIndex { get; init; }
    }
}
