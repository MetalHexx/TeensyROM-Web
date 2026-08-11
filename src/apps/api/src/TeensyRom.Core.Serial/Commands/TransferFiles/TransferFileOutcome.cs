using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Core.Commands
{
    /// <summary>
    /// The result of one file's pass through <see cref="TransferFilesCommandHandler"/>. Attempted is
    /// false only when the batch aborted before this file's handshake ever started.
    /// </summary>
    public sealed record TransferFileOutcome(
        StreamedFileTransfer File, bool Saved, string? Error, bool Attempted);
}
