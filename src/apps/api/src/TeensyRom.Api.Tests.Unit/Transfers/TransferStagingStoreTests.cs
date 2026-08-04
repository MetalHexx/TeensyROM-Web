using NSubstitute;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class TransferStagingStoreTests : IDisposable
{
    private readonly List<string> _roots = [];

    [Fact]
    public async Task StageAsync_RoundTrip_WritesBytesMatchingInputUnderOpaqueName()
    {
        var (store, root) = NewStore();
        var payload = new byte[] { 1, 2, 3, 4, 5 };

        string stagingPath;
        await using (var body = new MemoryStream(payload))
        {
            stagingPath = await store.StageAsync("job-1", body, CancellationToken.None);
        }

        stagingPath.Should().Be(Path.Combine(root, "job-1", "0.bin"));
        File.Exists(stagingPath).Should().BeTrue();
        (await File.ReadAllBytesAsync(stagingPath)).Should().Equal(payload);
    }

    [Fact]
    public async Task StageAsync_SecondFileForSameJob_UsesNextMonotonicOpaqueName()
    {
        var (store, root) = NewStore();
        await using (var first = new MemoryStream([1]))
        {
            await store.StageAsync("job-1", first, CancellationToken.None);
        }

        string second;
        await using (var body = new MemoryStream([2]))
        {
            second = await store.StageAsync("job-1", body, CancellationToken.None);
        }

        second.Should().Be(Path.Combine(root, "job-1", "1.bin"));
    }

    [Fact]
    public async Task StageAsync_CopyThrows_DeletesPartialFileAndRethrows()
    {
        var (store, root) = NewStore();
        using var body = new CancelsAfterFirstChunkStream([1, 2, 3]);

        var act = () => store.StageAsync("job-1", body, CancellationToken.None);

        await act.Should().ThrowAsync<OperationCanceledException>();

        var jobDir = Path.Combine(root, "job-1");
        Directory.Exists(jobDir).Should().BeTrue();
        Directory.EnumerateFileSystemEntries(jobDir).Should().BeEmpty();
    }

    [Fact]
    public async Task PurgeJob_RemovesJobDirectory()
    {
        var (store, root) = NewStore();
        await using (var body = new MemoryStream([1]))
        {
            await store.StageAsync("job-1", body, CancellationToken.None);
        }

        store.PurgeJob("job-1");

        Directory.Exists(Path.Combine(root, "job-1")).Should().BeFalse();
    }

    [Fact]
    public void PurgeJob_MissingJobDirectory_IsNoOp()
    {
        var (store, _) = NewStore();

        var act = () => store.PurgeJob("no-such-job");

        act.Should().NotThrow();
    }

    [Fact]
    public async Task SweepAll_EmptiesStagingRootButLeavesItInPlace()
    {
        var (store, root) = NewStore();
        await using (var a = new MemoryStream([1]))
        {
            await store.StageAsync("job-1", a, CancellationToken.None);
        }
        await using (var b = new MemoryStream([2]))
        {
            await store.StageAsync("job-2", b, CancellationToken.None);
        }

        store.SweepAll();

        Directory.Exists(root).Should().BeTrue();
        Directory.EnumerateFileSystemEntries(root).Should().BeEmpty();
    }

    [Fact]
    public void SweepAll_MissingStagingRoot_IsNoOp()
    {
        var missingRoot = Path.Combine(Path.GetTempPath(), $"teensyrom-staging-missing-{Guid.NewGuid():N}");
        var store = new TransferStagingStore(
            new TransferOptions { StagingRoot = missingRoot }, Substitute.For<ILoggingService>());

        var act = () => store.SweepAll();

        act.Should().NotThrow();
        Directory.Exists(missingRoot).Should().BeFalse();
    }

    [Fact]
    public void DeleteStagedFile_MissingFile_IsNoOp()
    {
        var (store, root) = NewStore();

        var act = () => store.DeleteStagedFile(Path.Combine(root, "does-not-exist.bin"));

        act.Should().NotThrow();
    }

    private (TransferStagingStore Store, string Root) NewStore()
    {
        var root = Directory.CreateTempSubdirectory("teensyrom-staging-tests-").FullName;
        _roots.Add(root);

        var options = new TransferOptions { StagingRoot = root };
        return (new TransferStagingStore(options, Substitute.For<ILoggingService>()), root);
    }

    public void Dispose()
    {
        foreach (var root in _roots.Where(Directory.Exists))
        {
            Directory.Delete(root, recursive: true);
        }
    }

    /// <summary>Writes one chunk synchronously, then simulates a cancelled copy on the next read.</summary>
    private sealed class CancelsAfterFirstChunkStream(byte[] firstChunk) : Stream
    {
        private bool _served;

        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position
        {
            get => throw new NotSupportedException();
            set => throw new NotSupportedException();
        }

        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
        {
            if (!_served)
            {
                _served = true;
                Array.Copy(firstChunk, 0, buffer, offset, firstChunk.Length);
                return Task.FromResult(firstChunk.Length);
            }

            throw new OperationCanceledException("Simulated mid-copy cancellation.");
        }

        public override void Flush() { }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
