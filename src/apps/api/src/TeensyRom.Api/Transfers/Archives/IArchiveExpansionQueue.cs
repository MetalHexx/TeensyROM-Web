using System.Threading.Channels;

namespace TeensyRom.Api.Transfers.Archives
{
    /// <summary>
    /// One top-level archive awaiting expansion. Depth 0; nested archives never enter this queue - they are
    /// discovered mid-walk and pushed onto the walk's own work stack instead.
    /// </summary>
    public sealed record ArchiveExpansionRequest(
        string JobId, string ScratchArchivePath, string ArchiveRelativePath);

    /// <summary>
    /// A single, global, unbounded queue of top-level archives awaiting expansion - one archive at a time,
    /// across every job, never just per job. Expansion is disk-bound; serialising it globally bounds
    /// scratch pressure without any extra accounting. Runs on its own background pump
    /// (<see cref="ArchiveExpansionPump"/>) so the upload request that enqueues an archive returns
    /// immediately, and expansion never runs inside the device-write loop.
    /// </summary>
    public interface IArchiveExpansionQueue
    {
        ValueTask EnqueueAsync(ArchiveExpansionRequest request, CancellationToken ct);
        IAsyncEnumerable<ArchiveExpansionRequest> ReadAllAsync(CancellationToken ct);
    }
}
