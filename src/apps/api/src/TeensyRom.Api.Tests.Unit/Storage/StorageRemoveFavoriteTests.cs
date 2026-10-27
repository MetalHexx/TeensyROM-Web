using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Commands.DeleteFile;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Games;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Music;
using TeensyRom.Core.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Storage;

public class StorageRemoveFavoriteTests
{
    private readonly IStorageCache _cache = Substitute.For<IStorageCache>();
    private readonly IMediator _mediator = Substitute.For<IMediator>();

    public StorageRemoveFavoriteTests() => _cache.FindSiblings(Arg.Any<FileItem>()).Returns([]);

    private StorageService NewService() => new(
        _cache,
        new StorageSettings
        {
            CartStorage = new CartStorage(TeensyStorageType.SD, available: true) { DeviceId = "device-1" },
            BanSource = () => new TeensyRom.Core.Settings.SearchSettings()
        },
        _mediator,
        Substitute.For<ILoggingService>(),
        Substitute.For<ISidMetadataService>(),
        Substitute.For<IGameMetadataService>(),
        Substitute.For<ICommunicationPort>());

    private static LaunchableItem Tune(string path) =>
        new() { Name = new FilePath(path).FileName, Path = new FilePath(path), Size = 10, IsFavorite = true };

    [Fact]
    public async Task RemoveFavorite_DeleteRefused_LeavesTheFileMarkedFavoriteInTheCache()
    {
        var file = Tune("/music/tune.sid");
        _cache.GetFavoriteFiles().Returns([Tune("/favorites/tune.sid")]);
        _mediator.Send(Arg.Any<DeleteFileCommand>(), Arg.Any<CancellationToken>())
            .Returns(new DeleteFileResult { IsSuccess = false, Error = "busy", ActiveTransferJobId = "job-1" });

        var removed = await NewService().RemoveFavorite(file, TeensyStorageType.SD, CancellationToken.None);

        removed.Should().BeFalse();
        file.IsFavorite.Should().BeTrue();
        _cache.Received().UpsertFile(Arg.Is<FileItem>(f => f.IsFavorite && f.Name == "tune.sid"));
        _cache.DidNotReceive().DeleteFile(Arg.Any<FilePath>());
    }

    [Fact]
    public async Task RemoveFavorite_DeleteSucceeds_ClearsTheFavoriteFlag()
    {
        var file = Tune("/music/tune.sid");
        _cache.GetFavoriteFiles().Returns([Tune("/favorites/tune.sid")]);
        _mediator.Send(Arg.Any<DeleteFileCommand>(), Arg.Any<CancellationToken>()).Returns(new DeleteFileResult());

        var removed = await NewService().RemoveFavorite(file, TeensyStorageType.SD, CancellationToken.None);

        removed.Should().BeTrue();
        file.IsFavorite.Should().BeFalse();
    }
}
