using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Commands.DeleteFile
{
    public class DeleteFileCommand : ITeensyCommand<DeleteFileResult>
    {
        public required TeensyStorageType StorageType { get; init; }
        public required FilePath Path { get; init; }
        public string? DeviceId { get; set; }
        public required ISerialStateContext Serial { get; init; }
    }
}
