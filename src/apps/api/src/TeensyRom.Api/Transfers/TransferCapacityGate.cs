namespace TeensyRom.Api.Transfers
{
    public sealed class TransferCapacityGate : ITransferCapacityGate
    {
        private readonly TransferOptions _options;
        private readonly object _byteLock = new();
        private long _bytesInUse;
        private int _filesInUse;
        private TaskCompletionSource<bool> _byteBudgetFreed =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public TransferCapacityGate(TransferOptions options)
        {
            _options = options;
        }

        public (int Files, long Bytes) Current
        {
            get
            {
                lock (_byteLock)
                {
                    return (_filesInUse, _bytesInUse);
                }
            }
        }

        public async Task WaitForSlotAsync(long sizeBytes, CancellationToken ct)
        {
            // Clamped so a single file larger than the whole byte budget can still admit into an
            // otherwise-empty staging area, instead of waiting forever.
            var reserved = Math.Min(sizeBytes, _options.MaxStagedBytes);

            await ReserveBytesAsync(reserved, ct).ConfigureAwait(false);
        }

        public void ReleaseSlot(long sizeBytes)
        {
            lock (_byteLock)
            {
                _bytesInUse -= sizeBytes;
                _filesInUse--;
            }

            SignalByteBudgetFreed();
        }

        public long Adjust(long reservedBytes, long actualBytes)
        {
            var previousEffective = Math.Min(reservedBytes, _options.MaxStagedBytes);
            var newEffective = Math.Min(actualBytes, _options.MaxStagedBytes);
            var delta = newEffective - previousEffective;

            if (delta != 0)
            {
                lock (_byteLock)
                {
                    _bytesInUse += delta;
                }
            }

            if (delta < 0)
            {
                SignalByteBudgetFreed();
            }

            return newEffective;
        }

        private async Task ReserveBytesAsync(long reserved, CancellationToken ct)
        {
            while (true)
            {
                Task freedSignal;

                lock (_byteLock)
                {
                    if (_bytesInUse + reserved <= _options.MaxStagedBytes)
                    {
                        _bytesInUse += reserved;
                        _filesInUse++;
                        return;
                    }

                    freedSignal = _byteBudgetFreed.Task;
                }

                await freedSignal.WaitAsync(ct).ConfigureAwait(false);
            }
        }

        private void SignalByteBudgetFreed()
        {
            var previous = Interlocked.Exchange(
                ref _byteBudgetFreed,
                new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously));

            previous.TrySetResult(true);
        }
    }
}
