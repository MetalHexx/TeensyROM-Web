using TeensyRom.Core.Commands;
using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Logging;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Core.Tests.Storage;

public class TransferFilesCommandHandlerTests : IDisposable
{
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly string _tempDir = Directory.CreateTempSubdirectory("transfer-files-handler-tests-").FullName;

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    private static Func<TransferFileOutcome, CancellationToken, Task> NoOp => (_, _) => Task.CompletedTask;

    [Fact]
    public async Task Handle_SuccessfulSave_SendsHandshakeThenBodyAndReturnsSaved()
    {
        var (path, bytes) = WriteTestFile(20_000);
        var target = new FilePath("/games/test.prg");
        var transfer = StreamedFileTransfer.FromFile(path, target, TeensyStorageType.SD);
        var port = new RecordingCommunicationPort();
        var handler = new TransferFilesCommandHandler(_log);

        var result = await handler.Handle(new TransferFilesCommand
        {
            Files = [transfer],
            DeviceId = "DEVICEID",
            CommunicationPort = port,
            OnFileCompleted = NoOp
        }, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Outcomes.Should().ContainSingle(o => o.Saved && o.Attempted && o.Error == null);
        port.AttemptCount.Should().Be(1);
        port.Received.Should().ContainSingle();
        port.Received[0].Path.Should().Be(target.Value);
        port.Received[0].StreamLength.Should().Be(transfer.StreamLength);
        port.Received[0].Checksum.Should().Be(transfer.Checksum);
        port.Received[0].Body.Should().Equal(bytes);
    }

    [Fact]
    public async Task Handle_MultiChunkSave_SendsEveryChunkAndReturnsSaved()
    {
        var (path, bytes) = WriteTestFile(40_001);
        var target = new FilePath("/games/multichunk.prg");
        var transfer = StreamedFileTransfer.FromFile(path, target, TeensyStorageType.SD);
        var port = new RecordingCommunicationPort();
        var handler = new TransferFilesCommandHandler(_log);

        var result = await handler.Handle(new TransferFilesCommand
        {
            Files = [transfer],
            DeviceId = "DEVICEID",
            CommunicationPort = port,
            OnFileCompleted = NoOp
        }, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Outcomes.Should().ContainSingle(o => o.Saved);
        port.AttemptCount.Should().Be(1);
        port.Received.Should().ContainSingle();
        port.Received[0].Body.Should().Equal(bytes);
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
        var handler = new TransferFilesCommandHandler(_log);

        var result = await handler.Handle(new TransferFilesCommand
        {
            Files = [transfer],
            DeviceId = "DEVICEID",
            CommunicationPort = port,
            OnFileCompleted = NoOp
        }, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Outcomes.Should().ContainSingle(o => o.Saved);
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
        var handler = new TransferFilesCommandHandler(_log);

        var result = await handler.Handle(new TransferFilesCommand
        {
            Files = [transfer],
            DeviceId = "DEVICEID",
            CommunicationPort = port,
            OnFileCompleted = NoOp
        }, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Outcomes.Should().ContainSingle();
        result.Outcomes[0].Saved.Should().BeFalse();
        result.Outcomes[0].Attempted.Should().BeTrue();
        result.Outcomes[0].Error.Should().NotBeNullOrEmpty();
        port.AttemptCount.Should().Be(3);
    }

    [Fact]
    public async Task Handle_ThreeFiles_WritesInOrderAndInvokesOnFileCompletedPerFileBeforeNextFile()
    {
        var files = Enumerable.Range(1, 3)
            .Select(i =>
            {
                var (path, _) = WriteTestFile(200 * i);
                return StreamedFileTransfer.FromFile(path, new FilePath($"/games/batch-{i}.prg"), TeensyStorageType.SD);
            })
            .ToList();

        var port = new RecordingCommunicationPort();
        var handler = new TransferFilesCommandHandler(_log);
        var attemptCountAtCompletion = new List<int>();

        var result = await handler.Handle(new TransferFilesCommand
        {
            Files = files,
            DeviceId = "DEVICEID",
            CommunicationPort = port,
            OnFileCompleted = (_, _) =>
            {
                attemptCountAtCompletion.Add(port.AttemptCount);
                return Task.CompletedTask;
            }
        }, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Outcomes.Select(o => o.File).Should().Equal(files);
        result.Outcomes.Should().OnlyContain(o => o.Saved && o.Attempted);

        // Each file takes exactly one attempt on this port, so a callback fired strictly between
        // files (rather than batched up after the loop) sees the attempt count climb one at a time.
        attemptCountAtCompletion.Should().Equal(1, 2, 3);
        port.Received.Select(f => f.Path).Should().Equal(files.Select(f => f.TargetPath.Value));
    }

    [Fact]
    public async Task Handle_MiddleFileFailsAllAttempts_OuterFilesLandAndBatchContinues()
    {
        var file1 = StreamedFileTransfer.FromFile(WriteTestFile(300).Path, new FilePath("/games/first.prg"), TeensyStorageType.SD);
        var file2 = StreamedFileTransfer.FromFile(WriteTestFile(300).Path, new FilePath("/games/second.prg"), TeensyStorageType.SD);
        var file3 = StreamedFileTransfer.FromFile(WriteTestFile(300).Path, new FilePath("/games/third.prg"), TeensyStorageType.SD);

        var port = new RecordingCommunicationPort
        {
            FailFor = path => path == file2.TargetPath.Value ? new IOException("bad file") : null
        };
        var handler = new TransferFilesCommandHandler(_log);
        var outcomes = new List<TransferFileOutcome>();

        var result = await handler.Handle(new TransferFilesCommand
        {
            Files = [file1, file2, file3],
            DeviceId = "DEVICEID",
            CommunicationPort = port,
            OnFileCompleted = (outcome, _) =>
            {
                outcomes.Add(outcome);
                return Task.CompletedTask;
            }
        }, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Outcomes.Should().HaveCount(3);
        outcomes.Should().Equal(result.Outcomes);

        result.Outcomes[0].Saved.Should().BeTrue();

        result.Outcomes[1].Saved.Should().BeFalse();
        result.Outcomes[1].Attempted.Should().BeTrue();
        result.Outcomes[1].Error.Should().NotBeNullOrEmpty();

        result.Outcomes[2].Saved.Should().BeTrue();

        port.Received.Select(f => f.Path).Should().Equal(file1.TargetPath.Value, file3.TargetPath.Value);
    }

    [Fact]
    public async Task Handle_DeviceVanishesMidBatch_AbortsRemainderAsUnattempted()
    {
        var file1 = StreamedFileTransfer.FromFile(WriteTestFile(200).Path, new FilePath("/games/one.prg"), TeensyStorageType.SD);
        var file2 = StreamedFileTransfer.FromFile(WriteTestFile(200).Path, new FilePath("/games/two.prg"), TeensyStorageType.SD);
        var file3 = StreamedFileTransfer.FromFile(WriteTestFile(200).Path, new FilePath("/games/three.prg"), TeensyStorageType.SD);

        RecordingCommunicationPort port = null!;
        port = new RecordingCommunicationPort
        {
            FailFor = path =>
            {
                if (path != file2.TargetPath.Value) return null;

                // Simulate the device physically vanishing mid-write, the same way a real port's
                // IsOpen would flip false, rather than just a bad file on an otherwise-live port.
                port.ClosePort();
                return new IOException("Fake device connection lost.");
            }
        };
        var handler = new TransferFilesCommandHandler(_log);
        var outcomes = new List<TransferFileOutcome>();

        var result = await handler.Handle(new TransferFilesCommand
        {
            Files = [file1, file2, file3],
            DeviceId = "DEVICEID",
            CommunicationPort = port,
            OnFileCompleted = (outcome, _) =>
            {
                outcomes.Add(outcome);
                return Task.CompletedTask;
            }
        }, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Outcomes.Should().HaveCount(3);
        outcomes.Should().Equal(result.Outcomes);

        result.Outcomes[0].Saved.Should().BeTrue();
        result.Outcomes[0].Attempted.Should().BeTrue();

        result.Outcomes[1].Saved.Should().BeFalse();
        result.Outcomes[1].Attempted.Should().BeTrue();

        result.Outcomes[2].Saved.Should().BeFalse();
        result.Outcomes[2].Attempted.Should().BeFalse();

        port.Received.Should().ContainSingle(f => f.Path == file1.TargetPath.Value);
    }

    [Fact]
    public async Task Handle_CancellationBetweenFiles_StopsBatchWithoutStartingNextFilesHandshake()
    {
        var file1 = StreamedFileTransfer.FromFile(WriteTestFile(200).Path, new FilePath("/games/one.prg"), TeensyStorageType.SD);
        var file2 = StreamedFileTransfer.FromFile(WriteTestFile(200).Path, new FilePath("/games/two.prg"), TeensyStorageType.SD);

        var port = new RecordingCommunicationPort();
        var handler = new TransferFilesCommandHandler(_log);
        using var cts = new CancellationTokenSource();

        Func<Task> act = () => handler.Handle(new TransferFilesCommand
        {
            Files = [file1, file2],
            DeviceId = "DEVICEID",
            CommunicationPort = port,
            OnFileCompleted = (_, _) =>
            {
                cts.Cancel();
                return Task.CompletedTask;
            }
        }, cts.Token);

        await act.Should().ThrowAsync<OperationCanceledException>();

        port.AttemptCount.Should().Be(1);
        port.Received.Should().ContainSingle(f => f.Path == file1.TargetPath.Value);
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
