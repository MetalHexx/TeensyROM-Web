using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Core.Commands
{
    /// <summary>
    /// The result of one file's pass through <see cref="TransferFilesCommandHandler"/>. Attempted is
    /// false when the file's handshake never started, which happens for one of two reasons: the device
    /// vanished on an earlier file in this batch (<see cref="DeviceLost"/> true, the whole remainder is
    /// abandoned), or <see cref="TransferFilesCommand.ShouldSkip"/> said this one file should not be
    /// sent while the rest of the batch still can be (<see cref="DeviceLost"/> false).
    /// </summary>
    public sealed record TransferFileOutcome(
        StreamedFileTransfer File, bool Saved, string? Error, bool Attempted, bool DeviceLost = false);
}
