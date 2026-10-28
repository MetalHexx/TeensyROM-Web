using TeensyRom.Core.Serial.Commands;
using TeensyRom.Core.Abstractions;

namespace TeensyRom.Core.Commands
{
    public class ResetCommand : ITeensyCommand<ResetResult>, ITransferCommand
    {
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
        public string? TransferJobId { get; init; }
    }
}
