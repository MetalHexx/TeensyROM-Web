using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Commands
{
    public class GetDirectoryRecursiveCommand : ITeensyCommand<GetDirectoryRecursiveResult>
    {
        public required TeensyStorageType StorageType { get; init; }
        public required DirectoryPath Path { get; init; }
        public required bool Recursive { get; init; }
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
    }
}
