using MediatR;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands.GetFile;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Games;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Music;
using TeensyRom.Core.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Storage;

public class StorageServiceReadFileBytesTests
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
    public async Task ReadFileBytes_SendsGetFileCommandWithSettingsAndPort()
    {
        var path = new FilePath("/music/tune.sid");
        _mediator.Send(Arg.Any<GetFileCommand>(), Arg.Any<CancellationToken>())
            .Returns(new GetFileResult { FileData = [1, 2, 3] });
        var service = NewService();

        await service.ReadFileBytes(path, CancellationToken.None);

        await _mediator.Received(1).Send(
            Arg.Is<GetFileCommand>(c =>
                c.StorageType == TeensyStorageType.SD &&
                c.FilePath.Equals(path) &&
                c.DeviceId == "device-1" &&
                c.CommunicationPort == _port),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReadFileBytes_Success_ReturnsSuccessWithSameBytes()
    {
        var bytes = new byte[] { 1, 2, 3 };
        _mediator.Send(Arg.Any<GetFileCommand>(), Arg.Any<CancellationToken>())
            .Returns(new GetFileResult { FileData = bytes });
        var service = NewService();

        var result = await service.ReadFileBytes(new FilePath("/music/tune.sid"), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Bytes.Should().BeSameAs(bytes);
        _cache.DidNotReceive().WriteToDisk();
    }

    [Theory]
    [InlineData(GetFileErrorCode.FileNotFound, FileBytesError.NotFound)]
    [InlineData(GetFileErrorCode.FileOpenError, FileBytesError.NotFound)]
    [InlineData(GetFileErrorCode.PathParamError, FileBytesError.NotFound)]
    [InlineData(GetFileErrorCode.StorageUnavailable, FileBytesError.StorageUnavailable)]
    [InlineData(GetFileErrorCode.StorageParamError, FileBytesError.StorageUnavailable)]
    [InlineData(GetFileErrorCode.UnknownError, FileBytesError.Failed)]
    public async Task ReadFileBytes_ErrorCode_MapsToExpectedFileBytesError(GetFileErrorCode errorCode, FileBytesError expected)
    {
        _mediator.Send(Arg.Any<GetFileCommand>(), Arg.Any<CancellationToken>())
            .Returns(new GetFileResult { IsSuccess = false, ErrorCode = errorCode });
        var service = NewService();

        var result = await service.ReadFileBytes(new FilePath("/music/tune.sid"), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Be(expected);
        _cache.DidNotReceive().WriteToDisk();
    }

    [Fact]
    public async Task ReadFileBytes_SuccessWithNullFileData_MapsToFailed()
    {
        _mediator.Send(Arg.Any<GetFileCommand>(), Arg.Any<CancellationToken>())
            .Returns(new GetFileResult { FileData = null! });
        var service = NewService();

        var result = await service.ReadFileBytes(new FilePath("/music/tune.sid"), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Be(FileBytesError.Failed);
        _cache.DidNotReceive().WriteToDisk();
    }
}
