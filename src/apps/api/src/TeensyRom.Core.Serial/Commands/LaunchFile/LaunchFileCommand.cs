using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Commands.File.LaunchFile
{
    public class LaunchFileCommand : ITeensyCommand<LaunchFileResult>
    {
        public required TeensyStorageType StorageType { get; init; }
        public required LaunchableItem LaunchItem { get; init; }
        public FilePath Path => LaunchItem.Path;
        public long Size => LaunchItem.Size;
        public string? DeviceId { get; set; }
        public required ISerialStateContext Serial { get; init; }
    }
}