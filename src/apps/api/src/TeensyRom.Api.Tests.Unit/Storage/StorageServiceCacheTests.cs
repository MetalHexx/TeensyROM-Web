using MediatR;
using TeensyRom.Api.Tests.Unit.Endpoints;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Games;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Music;
using TeensyRom.Core.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Storage;

public class StorageServiceCacheTests
{
    private readonly IStorageCache _cache = Substitute.For<IStorageCache>();
    private readonly IMediator _mediator = Substitute.For<IMediator>();

    private StorageService NewService(IDeviceTransferLease lease) => new(
        _cache,
        new StorageSettings { CartStorage = new CartStorage(TeensyStorageType.SD, available: true) { DeviceId = "device-1" } },
        _mediator,
        Substitute.For<ILoggingService>(),
        Substitute.For<ISidMetadataService>(),
        Substitute.For<IGameMetadataService>(),
        Substitute.For<ICommunicationPort>(),
        lease);

    [Fact]
    public async Task Cache_DeviceHeldByATransfer_IsRefusedBeforeTheCacheIsClearedOrTheDeviceRead()
    {
        var service = NewService(LeaseDoubles.Busy());

        var rootResult = await service.CacheAll(CancellationToken.None);
        var subDirResult = await service.Cache(new DirectoryPath("/music/"), CancellationToken.None);

        rootResult.Should().BeFalse();
        subDirResult.Should().BeFalse();
        _cache.DidNotReceive().ClearCache();
        _cache.DidNotReceive().DeleteDirectoryWithChildren(Arg.Any<DirectoryPath>());
        await _mediator.DidNotReceive().Send(Arg.Any<GetDirectoryRecursiveCommand>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CacheAll_FreeDevice_ClearsTheCacheAndReadsTheDevice()
    {
        _mediator.Send(Arg.Any<GetDirectoryRecursiveCommand>(), Arg.Any<CancellationToken>())
            .Returns(new GetDirectoryRecursiveResult { DirectoryContent = [] });

        var cached = await NewService(LeaseDoubles.Free()).CacheAll(CancellationToken.None);

        cached.Should().BeTrue();
        _cache.Received(1).ClearCache();
    }
}
