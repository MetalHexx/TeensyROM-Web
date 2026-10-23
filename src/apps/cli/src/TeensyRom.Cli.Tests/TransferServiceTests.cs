using NSubstitute;
using NSubstitute.ExceptionExtensions;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Services;
using ApiStorageType = TeensyRom.Cli.Api.Generated.TeensyStorageType;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Tests;

public sealed class TransferServiceTests : IDisposable
{
    private const string DeviceId = "a-1";

    private readonly ITeensyRomApiClient _api = Substitute.For<ITeensyRomApiClient>();
    private readonly IDeviceService _devices = Substitute.For<IDeviceService>();
    private readonly TransferService _sut;
    private readonly string _folder = Directory.CreateTempSubdirectory("trom-transfer-").FullName;

    public TransferServiceTests()
    {
        _devices.RequireDeviceId().Returns(DeviceId);
        _devices.SelectedDevice.Returns(new DeviceSummary(DeviceId, "Alpha", true, "USB COM3", "Connected"));
        _sut = new TransferService(_api, _devices);
    }

    public void Dispose() => Directory.Delete(_folder, recursive: true);

    private static TransferJobDto Job(TransferJobState state = TransferJobState.Created) => new() { JobId = "job-1", DeviceId = DeviceId, State = state };

    [Fact]
    public async Task Create_StartsAJobOnTheSelectedDevice_WithTheFolderAndArchiveCount()
    {
        CreateJobBody? body = null;
        _api.CreateTransferJobAsync(DeviceId, ApiStorageType.USB, Arg.Do<CreateJobBody>(b => body = b), Arg.Any<CancellationToken>())
            .Returns(new CreateJobResponse { JobId = "job-1", Job = Job() });

        var job = await _sut.CreateAsync(TeensyStorageType.USB, "/games", 2, CancellationToken.None);

        job.JobId.Should().Be("job-1");
        body!.DestinationDirectory.Should().Be("/games");
        body.ExpectedArchiveCount.Should().Be(2);
    }

    [Fact]
    public async Task Create_OnABusyDevice_IsAFailureThatNamesTheDevice()
    {
        _api.CreateTransferJobAsync(default!, default, default!, default)
            .ThrowsAsyncForAnyArgs(ApiTestSupport.ApiFailure(409, """{"title":"Device already has an active transfer."}"""));

        var act = () => _sut.CreateAsync(TeensyStorageType.SD, "/x", 0, CancellationToken.None);

        var error = (await act.Should().ThrowAsync<CliException>()).Which;
        error.Code.Should().Be(CliExitCode.Failed);
        error.Message.Should().Be("Alpha is busy with another transfer — try again when it finishes.");
    }

    [Fact]
    public async Task Create_RefusedAnotherWay_KeepsTheEnginesSentence()
    {
        _api.CreateTransferJobAsync(default!, default, default!, default)
            .ThrowsAsyncForAnyArgs(ApiTestSupport.ApiFailure(404, """{"title":"The storage SD is not available."}"""));

        var act = () => _sut.CreateAsync(TeensyStorageType.SD, "/x", 0, CancellationToken.None);

        var error = (await act.Should().ThrowAsync<TeensyApiException>()).Which;
        error.StatusCode.Should().Be(404);
        error.Message.Should().Be("The storage SD is not available.");
    }

    [Fact]
    public async Task Upload_StreamsTheFile_WithItsExactLength_AtTheRelativePath()
    {
        var bytes = Enumerable.Range(0, 300_000).Select(i => (byte)(i % 251)).ToArray();
        var file = Path.Combine(_folder, "big.prg");
        await File.WriteAllBytesAsync(file, bytes);
        byte[]? received = null;
        long? length = null;
        _api.UploadTransferFileContentAsync("job-1", "games/big.prg", Arg.Any<Stream>(), Arg.Any<long>(), Arg.Any<CancellationToken>())
            .Returns(async call =>
            {
                length = call.ArgAt<long>(3);
                using var copy = new MemoryStream();
                await call.ArgAt<Stream>(2).CopyToAsync(copy);
                received = copy.ToArray();
                return new UploadFileResponse { RelativePath = "games/big.prg", SizeBytes = bytes.Length, Queued = true };
            });

        await _sut.UploadAsync("job-1", "games/big.prg", file, CancellationToken.None);

        length.Should().Be(bytes.Length);
        received.Should().Equal(bytes);
    }

    [Fact]
    public async Task Download_CopiesTheFilesBytesIntoTheDestination_AndLeavesItOpen()
    {
        var bytes = Enumerable.Range(0, 300_000).Select(i => (byte)(i % 251)).ToArray();
        var source = new MemoryStream(bytes);
        _api.GetFileContentAsync(DeviceId, ApiStorageType.USB, "/games/big.prg", Arg.Any<CancellationToken>())
            .Returns(new FileResponse(200, new Dictionary<string, IEnumerable<string>>(), source, null, null));
        using var destination = new MemoryStream();

        await _sut.DownloadAsync(TeensyStorageType.USB, "/games/big.prg", destination, CancellationToken.None);

        destination.ToArray().Should().Equal(bytes);
        destination.CanWrite.Should().BeTrue();
        source.CanRead.Should().BeFalse("the response is disposed once copied");
    }

    [Fact]
    public async Task Download_OfAFileOverTheLimit_IsATeensyApiExceptionWith413()
    {
        _api.GetFileContentAsync(default!, default, default, default)
            .ThrowsAsyncForAnyArgs(ApiTestSupport.ApiFailure(413, """{"title":"File is too large."}"""));

        var act = () => _sut.DownloadAsync(TeensyStorageType.SD, "/big.prg", new MemoryStream(), CancellationToken.None);

        (await act.Should().ThrowAsync<TeensyApiException>()).Which.StatusCode.Should().Be(413);
    }

    [Theory]
    [InlineData("../evil.prg")]
    [InlineData("games/../../evil.prg")]
    [InlineData("/etc/evil.prg")]
    [InlineData("games//a.prg")]
    [InlineData("games/./a.prg")]
    [InlineData("..\\evil.prg")]
    [InlineData("")]
    public async Task Upload_NeverSendsAPathThatLeavesTheDestination(string relativePath)
    {
        var file = Path.Combine(_folder, "a.prg");
        await File.WriteAllBytesAsync(file, [1]);

        var act = () => _sut.UploadAsync("job-1", relativePath, file, CancellationToken.None);

        await act.Should().ThrowAsync<ArgumentException>();
        await _api.DidNotReceiveWithAnyArgs().UploadTransferFileContentAsync(default!, default!, default!, default);
    }

    [Fact]
    public async Task Upload_OfAFileThatCantBeOpened_IsAnIoErrorAndSendsNothing()
    {
        var act = () => _sut.UploadAsync("job-1", "gone.prg", Path.Combine(_folder, "gone.prg"), CancellationToken.None);

        await act.Should().ThrowAsync<IOException>();
        await _api.DidNotReceiveWithAnyArgs().UploadTransferFileContentAsync(default!, default!, default!, default);
    }

    [Fact]
    public async Task Upload_Refused400_IsATeensyApiExceptionWithTheEnginesSentence()
    {
        var file = Path.Combine(_folder, "a.prg");
        await File.WriteAllBytesAsync(file, [1]);
        _api.UploadTransferFileContentAsync(default!, default!, default!, default, default)
            .ThrowsAsyncForAnyArgs(ApiTestSupport.ApiFailure(400, """{"title":"The path is not usable."}"""));

        var act = () => _sut.UploadAsync("job-1", "a.prg", file, CancellationToken.None);

        var error = (await act.Should().ThrowAsync<TeensyApiException>()).Which;
        error.StatusCode.Should().Be(400);
        error.Message.Should().Be("The path is not usable.");
    }

    [Fact]
    public async Task Get_ReturnsTheJob()
    {
        _api.GetTransferJobAsync("job-1", Arg.Any<CancellationToken>()).Returns(new GetJobResponse { Job = Job(TransferJobState.Receiving) });

        (await _sut.GetAsync("job-1", CancellationToken.None)).State.Should().Be(TransferJobState.Receiving);
    }

    [Fact]
    public async Task Seal_AsksTheEngineToSealTheJob()
    {
        _api.SealTransferJobAsync("job-1", Arg.Any<CancellationToken>()).Returns(new SealJobResponse());

        await _sut.SealAsync("job-1", CancellationToken.None);

        await _api.Received(1).SealTransferJobAsync("job-1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Cancel_OfAJobTheEngineHasForgotten_DoesNotThrow()
    {
        _api.CancelTransferJobAsync(default!, default).ThrowsAsyncForAnyArgs(ApiTestSupport.ApiFailure(404, """{"title":"No transfer job was found with id job-1."}"""));

        var act = () => _sut.CancelAsync("job-1");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Cancel_WhenTheEngineIsGone_Throws()
    {
        _api.CancelTransferJobAsync(default!, default).ThrowsAsyncForAnyArgs(new HttpRequestException("refused"));

        var act = () => _sut.CancelAsync("job-1");

        (await act.Should().ThrowAsync<TeensyApiException>()).Which.StatusCode.Should().BeNull();
    }
}
