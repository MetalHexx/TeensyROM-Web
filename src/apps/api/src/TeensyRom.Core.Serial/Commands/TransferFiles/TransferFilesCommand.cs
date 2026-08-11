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

        /// <summary>
        /// Checked immediately before each file's handshake would start - after every earlier file in
        /// the batch has already been reported through <see cref="OnFileCompleted"/>, so a caller can
        /// react to state that changed since the batch was composed. A true result skips just that one
        /// file (an unattempted <see cref="TransferFileOutcome"/> with <c>DeviceLost = false</c>) and the
        /// batch continues to the next file rather than aborting, since a batch can carry files for more
        /// than one job. Optional - callers with nothing to recheck mid-batch leave it unset.
        /// </summary>
        public Func<StreamedFileTransfer, bool>? ShouldSkip { get; init; }
    }
}
