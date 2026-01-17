using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Serial.Commands.LaunchFile.LaunchFileTcp
{
    public class LaunchFileCommand : ITeensyCommand<LaunchFileResult>, IRequiresFullFw
    {
        public required TeensyStorageType StorageType { get; init; }
        public required LaunchableItem LaunchItem { get; init; }
        public FilePath Path => LaunchItem.Path;
        public long Size => LaunchItem.Size;
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }
    }
}
