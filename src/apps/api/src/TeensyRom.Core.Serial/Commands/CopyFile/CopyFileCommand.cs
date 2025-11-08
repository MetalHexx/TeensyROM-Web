using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Commands
{
    public class CopyFileCommand : ITeensyCommand<CopyFileResult>
    {
        public required TeensyStorageType StorageType { get; init; }
        public required FilePath SourcePath { get; init; }
        public required FilePath DestPath { get; init; }
        public string? DeviceId { get; set; }
        public ISerialStateContext Serial { get; set; } = null!;
    }
}