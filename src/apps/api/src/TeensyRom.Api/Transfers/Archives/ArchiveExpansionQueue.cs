using System.Threading.Channels;

namespace TeensyRom.Api.Transfers.Archives
{
    /// <summary>
    /// Implements <see cref="IArchiveExpansionQueue"/> as one unbounded, single-reader channel shared by
    /// every job - mirrors <see cref="TransferQueue"/>'s channel shape, but global rather than per device
    /// because the resource being serialised (scratch disk, expanded one archive at a time) is global too.
    /// </summary>
    public sealed class ArchiveExpansionQueue : IArchiveExpansionQueue
    {
        private readonly Channel<ArchiveExpansionRequest> _channel =
            Channel.CreateUnbounded<ArchiveExpansionRequest>(new UnboundedChannelOptions { SingleReader = true });

        public ValueTask EnqueueAsync(ArchiveExpansionRequest request, CancellationToken ct) =>
            _channel.Writer.WriteAsync(request, ct);

        public IAsyncEnumerable<ArchiveExpansionRequest> ReadAllAsync(CancellationToken ct) =>
            _channel.Reader.ReadAllAsync(ct);
    }
}
