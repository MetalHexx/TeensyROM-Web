using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Commands.GetFile
{
    public class GetFileCommand : ITeensyCommand<GetFileResult>
    {
        public required TeensyStorageType StorageType { get; init; }
        public required FilePath FilePath { get; init; }
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
    }
}
