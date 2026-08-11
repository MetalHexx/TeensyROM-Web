using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands;

namespace TeensyRom.Core.Commands
{
    public sealed class TransferFilesCommand : ITeensyCommand<TransferFilesResult>
    {
        public required List<StreamedFileTransfer> Files { get; init; }
        public string? DeviceId { get; set; }
        public required ICommunicationPort CommunicationPort { get; init; }

        /// <summary>
        /// Invoked after each file completes, before the handler moves to the next.
        /// </summary>
        public required Func<TransferFileOutcome, CancellationToken, Task> OnFileCompleted { get; init; }
    }
}
