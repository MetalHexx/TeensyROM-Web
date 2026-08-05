using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands;

namespace TeensyRom.Core.Commands
{
    public sealed class SaveFileCommand : ITeensyCommand<SaveFileResult>
    {
        public required StreamedFileTransfer File { get; init; }
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
    }
}
