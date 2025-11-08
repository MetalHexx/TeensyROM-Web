using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands;

namespace TeensyRom.Core.Commands
{
    public class SaveFilesCommand : ITeensyCommand<SaveFilesResult>
    {
        public required List<FileTransferItem> Files { get; init; }
        public string? DeviceId { get; set; }
        public ISerialStateContext Serial { get; set; } = null!;
    }
}