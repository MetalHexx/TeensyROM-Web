using TeensyRom.Api.Transfers.Archives;

namespace TeensyRom.Api.Tests.Integration.Transfers
{
    /// <summary>
    /// Decorates a real <see cref="IArchiveReader"/> with a caller-controlled gate awaited before every
    /// entry <see cref="ExtractAsync"/> yields to its caller - substitution at the interface, the way
    /// production code is meant to be seamed, never a delay or a test-only method bolted onto the real
    /// reader. <see cref="IsArchiveExtension"/> and <see cref="ReadIndex"/> pass straight through: only
    /// extraction itself is ever slow in production, so only extraction is gated here.
    /// </summary>
    internal sealed class GatedArchiveReader(IArchiveReader inner, ArchiveExtractionGate gate) : IArchiveReader
    {
        public bool IsArchiveExtension(string relativePath) => inner.IsArchiveExtension(relativePath);

        public ArchiveIndex ReadIndex(string archivePath) => inner.ReadIndex(archivePath);

        public Task ExtractAsync(
            string archivePath,
            Func<ArchiveEntryInfo, Stream, CancellationToken, Task> onEntry,
            CancellationToken ct) =>
            inner.ExtractAsync(archivePath, async (entry, stream, entryCt) =>
            {
                await gate.WaitAsync(entryCt);
                await onEntry(entry, stream, entryCt);
            }, ct);
    }

    /// <summary>
    /// A one-shot open gate for <see cref="GatedArchiveReader"/>: closed until <see cref="Release"/> is
    /// called, then open forever after - mirroring <see cref="TeensyRom.Api.Transfers.ITransferAdmission.ReleaseHeldAsync"/>'s
    /// own one-time release. Lets a test hold expansion open for as long as it needs, then let every
    /// blocked (and every future) entry through with a single call.
    /// </summary>
    internal sealed class ArchiveExtractionGate
    {
        private readonly TaskCompletionSource _tcs = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public Task WaitAsync(CancellationToken ct) => _tcs.Task.WaitAsync(ct);

        public void Release() => _tcs.TrySetResult();
    }
}
