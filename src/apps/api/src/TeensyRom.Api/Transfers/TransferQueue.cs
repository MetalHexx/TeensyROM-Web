using System.Collections.Concurrent;
using System.Diagnostics.CodeAnalysis;
using System.Threading.Channels;
using TeensyRom.Core.Entities.Transfers;

namespace TeensyRom.Api.Transfers
{
    public sealed class TransferQueue : ITransferQueue
    {
        private readonly TransferOptions _options;
        private readonly ConcurrentDictionary<string, Channel<StagedFile>> _channels = new();

        public TransferQueue(TransferOptions options)
        {
            _options = options;
        }

        public IReadOnlyCollection<string> ActiveDeviceIds => _channels.Keys.ToArray();

        public ValueTask EnqueueAsync(string deviceId, StagedFile file, CancellationToken ct) =>
            GetOrCreateChannel(deviceId).Writer.WriteAsync(file, ct);

        public IAsyncEnumerable<StagedFile> ReadAllAsync(string deviceId, CancellationToken ct) =>
            GetOrCreateChannel(deviceId).Reader.ReadAllAsync(ct);

        public bool TryRead(string deviceId, [MaybeNullWhen(false)] out StagedFile file) =>
            GetOrCreateChannel(deviceId).Reader.TryRead(out file);

        private Channel<StagedFile> GetOrCreateChannel(string deviceId) =>
            _channels.GetOrAdd(deviceId, _ => Channel.CreateUnbounded<StagedFile>(
                new UnboundedChannelOptions { SingleReader = true }));
    }
}
