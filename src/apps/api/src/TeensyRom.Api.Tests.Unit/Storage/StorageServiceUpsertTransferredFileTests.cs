using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Games;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Music;
using TeensyRom.Core.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Storage;

/// <summary>
/// UpsertTransferredFile is the R10 storage-cache hook the pump calls per file: it must reuse MapFile's
/// enrichment and never touch disk itself (PersistCache is the pump's once-per-terminal-job call).
/// </summary>
public class StorageServiceUpsertTransferredFileTests
{
    private readonly IStorageCache _cache = Substitute.For<IStorageCache>();
    private readonly ISidMetadataService _sidMetadata = Substitute.For<ISidMetadataService>();
    private readonly IGameMetadataService _gameMetadata = Substitute.For<IGameMetadataService>();
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly IMediator _mediator = Substitute.For<IMediator>();
    private readonly ICommunicationPort _port = Substitute.For<ICommunicationPort>();

    private StorageService NewService() => new(
        _cache,
        new StorageSettings { CartStorage = new CartStorage(TeensyStorageType.SD, available: true) { DeviceId = "device-1" } },
        _mediator,
        _log,
        _sidMetadata,
        _gameMetadata,
        _port);

    [Fact]
    public void UpsertTransferredFile_SidExtension_ProducesEnrichedSongItem()
    {
        _sidMetadata.EnrichSong(Arg.Any<SongItem>()).Returns(call => call.Arg<SongItem>());
        var service = NewService();

        service.UpsertTransferredFile(new FilePath("/music/tune.sid"), 1234);

        _cache.Received(1).EnsureParents(new DirectoryPath("/music"));
        _cache.Received(1).UpsertFile(Arg.Is<FileItem>(f =>
            f is SongItem && f.Path.Equals(new FilePath("/music/tune.sid")) && f.Size == 1234));
        _cache.DidNotReceive().WriteToDisk();
    }

    [Fact]
    public void UpsertTransferredFile_UnknownExtension_ProducesPlainFileItem()
    {
        var service = NewService();

        service.UpsertTransferredFile(new FilePath("/misc/data.xyz"), 500);

        _cache.Received(1).UpsertFile(Arg.Is<FileItem>(f =>
            f.GetType() == typeof(FileItem) && f.Size == 500));
        _cache.DidNotReceive().WriteToDisk();
    }

    [Fact]
    public void PersistCache_WritesCacheToDisk()
    {
        var service = NewService();

        service.PersistCache();

        _cache.Received(1).WriteToDisk();
    }
}
