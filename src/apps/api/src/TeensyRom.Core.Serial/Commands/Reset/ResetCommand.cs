using TeensyRom.Core.Serial.Commands;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Core.Commands
{
    public class ResetCommand : ITeensyCommand<ResetResult>
    {
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
    }
}
