using TeensyRom.Core.Commands;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Tests.Storage;

public class SaveFileCommandHandlerTests : IDisposable
{
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly string _tempDir = Directory.CreateTempSubdirectory("save-file-handler-tests-").FullName;

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    [Fact]
    public async Task Handle_SuccessfulSave_SendsHandshakeThenBodyAndReturnsSaved()
    {
        var (path, bytes) = WriteTestFile(20_000);
        var target = new FilePath("/games/test.prg");
        var transfer = StreamedFileTransfer.FromFile(path, target, TeensyStorageType.SD);
        var port = new RecordingCommunicationPort();
        var handler = new SaveFileCommandHandler(_log);

        var result = await handler.Handle(new SaveFileCommand
        {
            File = transfer,
            DeviceId = "DEVICEID",
            CommunicationPort = port
        }, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Saved.Should().BeTrue();
        port.AttemptCount.Should().Be(1);
        port.ReceivedTargetPath.Should().Be(target.Value);
        port.ReceivedStreamLength.Should().Be(transfer.StreamLength);
        port.ReceivedChecksum.Should().Be(transfer.Checksum);
        port.ReceivedBody.Should().Equal(bytes);
    }

    [Fact]
    public async Task Handle_MultiChunkSave_SendsEveryChunkAndReturnsSaved()
    {
        var (path, bytes) = WriteTestFile(40_001);
        var target = new FilePath("/games/multichunk.prg");
        var transfer = StreamedFileTransfer.FromFile(path, target, TeensyStorageType.SD);
        var port = new RecordingCommunicationPort();
        var handler = new SaveFileCommandHandler(_log);

        var result = await handler.Handle(new SaveFileCommand
        {
            File = transfer,
            DeviceId = "DEVICEID",
            CommunicationPort = port
        }, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Saved.Should().BeTrue();
        port.AttemptCount.Should().Be(1);
        port.ReceivedBody.Should().Equal(bytes);
    }

    [Fact]
    public async Task Handle_FileAlreadyExistsOnFirstAttempt_DeletesThenRetriesToSuccess()
    {
        var (path, _) = WriteTestFile(500);
        var target = new FilePath("/games/exists.prg");
        var transfer = StreamedFileTransfer.FromFile(path, target, TeensyStorageType.SD);
        var port = new RecordingCommunicationPort
        {
            ExceptionForAckCall = ackCallNumber => ackCallNumber == 1
                ? new TeensyException("File already exists")
                : null
        };
        var handler = new SaveFileCommandHandler(_log);

        var result = await handler.Handle(new SaveFileCommand
        {
            File = transfer,
            DeviceId = "DEVICEID",
            CommunicationPort = port
        }, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Saved.Should().BeTrue();
        port.DeletedPaths.Should().ContainSingle(deletedPath => deletedPath == target.Value);
        port.AttemptCount.Should().Be(2);
    }

    [Fact]
    public async Task Handle_PortAlwaysThrows_ReturnsFailureAfterRetryLimitWithoutThrowing()
    {
        var (path, _) = WriteTestFile(100);
        var target = new FilePath("/games/broken.prg");
        var transfer = StreamedFileTransfer.FromFile(path, target, TeensyStorageType.SD);
        var port = new RecordingCommunicationPort
        {
            ExceptionForAckCall = _ => new IOException("device offline")
        };
        var handler = new SaveFileCommandHandler(_log);

        var result = await handler.Handle(new SaveFileCommand
        {
            File = transfer,
            DeviceId = "DEVICEID",
            CommunicationPort = port
        }, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().NotBeNullOrEmpty();
        port.AttemptCount.Should().Be(3);
    }

    private (string Path, byte[] Bytes) WriteTestFile(int size)
    {
        var bytes = new byte[size];
        new Random(11).NextBytes(bytes);
        var path = Path.Combine(_tempDir, $"{Guid.NewGuid():N}.prg");
        File.WriteAllBytes(path, bytes);
        return (path, bytes);
    }
}
