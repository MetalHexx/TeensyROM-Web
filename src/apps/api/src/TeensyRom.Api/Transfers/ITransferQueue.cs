using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// A bounded queue of staged files per device. Per device, not global: a job targeting a different
    /// device must run concurrently and stay unaffected by a slow one, and a single shared channel with
    /// <c>SingleReader = true</c> would serialise writes across every device and head-of-line-block the
    /// rest. The capacity gate stays global — the resource it protects (host disk) is global — only the
    /// queues are per device.
    ///
    /// Deliberately not selectively purgeable. Cancelling a job does not walk the channel and remove its
    /// items; the pump drops items whose job is no longer active at dequeue time, deleting the staged
    /// file and releasing its capacity-gate slot. This will be the first thing a reader wants to change —
    /// resist it, a bounded <c>Channel&lt;T&gt;</c> offers no cheap way to remove an arbitrary item.
    /// </summary>
    public interface ITransferQueue
    {
        ValueTask EnqueueAsync(string deviceId, StagedFile file, CancellationToken ct);
        IAsyncEnumerable<StagedFile> ReadAllAsync(string deviceId, CancellationToken ct);
        IReadOnlyCollection<string> ActiveDeviceIds { get; }
    }
}
