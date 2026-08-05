namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// The single mechanism that bounds the staging area — by construction, not by convention. Also the
    /// flow control: an upload waits for a slot instead of being rejected, which is why there is no
    /// client-side backoff anywhere in this design.
    /// </summary>
    public interface ITransferCapacityGate
    {
        /// Blocks until both a file slot and <paramref name="sizeBytes"/> of byte budget are available.
        Task WaitForSlotAsync(long sizeBytes, CancellationToken ct);

        /// Releases exactly the reservation returned by <see cref="Adjust"/> — never <c>SizeBytes</c>.
        void ReleaseSlot(long sizeBytes);

        /// <summary>
        /// Reconciles the byte reservation once a chunked upload's true size is known. Returns the
        /// effective reservation now held, after re-clamping to <c>MaxStagedBytes</c> — the only value
        /// that may later be released.
        /// </summary>
        long Adjust(long reservedBytes, long actualBytes);

        (int Files, long Bytes) Current { get; }
    }
}
