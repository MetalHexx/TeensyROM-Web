using MediatR;
using TeensyRom.Api.Tests.Unit.Endpoints;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Games;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Music;
using TeensyRom.Core.Serial.Commands.Common;
using TeensyRom.Core.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Storage;

public class StorageServiceReadDirectoryTests
{
    private readonly IStorageCache _cache = Substitute.For<IStorageCache>();
    private readonly IMediator _mediator = Substitute.For<IMediator>();
    private static readonly DirectoryPath Music = new("/music/");

    public StorageServiceReadDirectoryTests()
    {
        _cache.GetByDirPath(Arg.Any<DirectoryPath>()).Returns((IStorageCacheItem?)null);
    }

    private StorageService NewService() => new(
        _cache,
        new StorageSettings { CartStorage = new CartStorage(TeensyStorageType.SD, available: true) { DeviceId = "device-1" } },
        _mediator,
        Substitute.For<ILoggingService>(),
        Substitute.For<ISidMetadataService>(),
        Substitute.For<IGameMetadataService>(),
        Substitute.For<ICommunicationPort>(),
        LeaseDoubles.Free());

    private void GivenCommandResult(GetDirectoryRecursiveResult result) =>
        _mediator.Send(Arg.Any<GetDirectoryRecursiveCommand>(), Arg.Any<CancellationToken>()).Returns(result);

    private static GetDirectoryRecursiveResult ListingWithOneFile() => new()
    {
        DirectoryContent = [new DirectoryContent { Path = Music, Files = [new FileItem { Name = "a.txt", Path = new FilePath("/music/a.txt") }] }]
    };

    [Fact]
    public async Task ReadDirectory_LinkFailureWithNoErrorCode_IsFailedWithTheMessage()
    {
        GivenCommandResult(new GetDirectoryRecursiveResult { IsSuccess = false, Error = "Unable to connect to COM7" });

        var result = await NewService().ReadDirectory(Music);

        result.Failure.Should().Be("Unable to connect to COM7");
        result.IsNotFound.Should().BeFalse();
        result.Item.Should().BeNull();
    }

    [Theory]
    [InlineData("")]
    [InlineData("\0\0")]
    public async Task ReadDirectory_FailureWithBlankError_IsFailedWithAGenericMessage(string error)
    {
        GivenCommandResult(new GetDirectoryRecursiveResult { IsSuccess = false, Error = error, ErrorCode = GetDirectoryErrorCode.UnknownError });

        var result = await NewService().ReadDirectory(Music);

        result.Failure.Should().NotBeNullOrWhiteSpace();
    }

    [Theory]
    [InlineData(GetDirectoryErrorCode.PathParamError)]
    [InlineData(GetDirectoryErrorCode.DirectoryNotFoundError)]
    [InlineData(GetDirectoryErrorCode.NotADirectoryError)]
    public async Task ReadDirectory_MissingDirectoryCodes_AreNotFound(GetDirectoryErrorCode code)
    {
        GivenCommandResult(new GetDirectoryRecursiveResult { IsSuccess = false, Error = "nope", ErrorCode = code });

        var result = await NewService().ReadDirectory(Music);

        result.IsNotFound.Should().BeTrue();
    }

    [Fact]
    public async Task ReadDirectory_EmptyFolder_IsFoundEmptyAndCached()
    {
        GivenCommandResult(new GetDirectoryRecursiveResult { DirectoryContent = [new DirectoryContent { Path = Music }] });

        var result = await NewService().ReadDirectory(Music);

        result.IsNotFound.Should().BeFalse();
        result.Failure.Should().BeNull();
        result.Item!.Files.Should().BeEmpty();
        result.Item.Directories.Should().BeEmpty();
        _cache.Received(1).WriteToDisk();
    }

    [Fact]
    public async Task ReadDirectory_SuccessWithContent_IsFoundAndWrittenToDisk()
    {
        GivenCommandResult(ListingWithOneFile());

        var result = await NewService().ReadDirectory(Music);

        result.Item!.Files.Should().ContainSingle();
        _cache.Received(1).WriteToDisk();
    }

    [Fact]
    public async Task ReadDirectory_SuccessWithoutContentEntry_IsNotFound()
    {
        GivenCommandResult(new GetDirectoryRecursiveResult());

        var result = await NewService().ReadDirectory(Music);

        result.IsNotFound.Should().BeTrue();
    }

    [Fact]
    public async Task LookupFile_FailedParentRead_IsFailedNotNotFound()
    {
        GivenCommandResult(new GetDirectoryRecursiveResult { IsSuccess = false, Error = "Unable to connect to COM7" });

        var result = await NewService().LookupFile(new FilePath("/music/tune.sid"));

        result.Failure.Should().Be("Unable to connect to COM7");
        result.IsNotFound.Should().BeFalse();
    }

    [Fact]
    public async Task LookupFile_FoundDirectoryWithoutTheFile_IsNotFound()
    {
        GivenCommandResult(ListingWithOneFile());
        var service = NewService();

        var result = await service.LookupFile(new FilePath("/music/tune.sid"));

        result.IsNotFound.Should().BeTrue();
        (await service.GetFile(new FilePath("/music/tune.sid"))).Should().BeNull();
    }
}
