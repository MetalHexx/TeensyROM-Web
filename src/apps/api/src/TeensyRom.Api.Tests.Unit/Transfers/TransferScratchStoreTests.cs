using NSubstitute;
using TeensyRom.Api.Transfers;
using TeensyRom.Core.Logging;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class TransferScratchStoreTests : IDisposable
{
    private readonly List<string> _roots = [];

    [Fact]
    public void TryReserve_WithinCeiling_SucceedsAndTracksBytesInUse()
    {
        var (store, _) = NewStore(maxScratchBytes: 100);

        var reserved = store.TryReserve("job-1", 60);

        reserved.Should().BeTrue();
        store.BytesInUse.Should().Be(60);
    }

    [Fact]
    public void TryReserve_WouldExceedCeiling_ReturnsFalseWithoutBlocking()
    {
        var (store, _) = NewStore(maxScratchBytes: 100);
        store.TryReserve("job-1", 90).Should().BeTrue();

        var reserved = store.TryReserve("job-2", 20);

        reserved.Should().BeFalse();
        store.BytesInUse.Should().Be(90);
    }

    [Fact]
    public void TryReserve_AfterPurgeFreesSpace_Succeeds()
    {
        var (store, _) = NewStore(maxScratchBytes: 100);
        store.TryReserve("job-1", 90).Should().BeTrue();
        store.TryReserve("job-2", 20).Should().BeFalse();

        store.PurgeJob("job-1");
        var reserved = store.TryReserve("job-2", 20);

        reserved.Should().BeTrue();
        store.BytesInUse.Should().Be(20);
    }

    [Fact]
    public void Release_ReturnsBytesToCeilingWithoutTouchingDisk()
    {
        var (store, root) = NewStore(maxScratchBytes: 100);
        var jobDir = store.EnsureJobDirectory("job-1");
        store.TryReserve("job-1", 60).Should().BeTrue();

        store.Release("job-1", 60);

        store.BytesInUse.Should().Be(0);
        Directory.Exists(jobDir).Should().BeTrue();
        Directory.Exists(root).Should().BeTrue();
    }

    [Fact]
    public void PurgeJob_DeletesDirectoryAndReturnsFullOutstandingReservation()
    {
        var (store, root) = NewStore(maxScratchBytes: 100);
        var jobDir = store.EnsureJobDirectory("job-1");
        File.WriteAllBytes(Path.Combine(jobDir, "0.bin"), [1, 2, 3]);
        store.TryReserve("job-1", 30).Should().BeTrue();
        store.TryReserve("job-1", 15).Should().BeTrue();

        store.PurgeJob("job-1");

        Directory.Exists(jobDir).Should().BeFalse();
        store.BytesInUse.Should().Be(0);
    }

    [Fact]
    public void PurgeJob_UnknownJobId_IsNoOp()
    {
        var (store, _) = NewStore(maxScratchBytes: 100);

        var act = () => store.PurgeJob("no-such-job");

        act.Should().NotThrow();
        store.BytesInUse.Should().Be(0);
    }

    [Fact]
    public void PurgeJob_DeleteFailureIsLoggedNotPropagated()
    {
        var log = Substitute.For<ILoggingService>();
        var root = Directory.CreateTempSubdirectory("teensyrom-scratch-tests-").FullName;
        _roots.Add(root);
        var options = new TransferOptions { ScratchRoot = root, MaxScratchBytes = 100 };
        var store = new TransferScratchStore(options, log);

        var jobDir = store.EnsureJobDirectory("job-1");
        store.TryReserve("job-1", 10).Should().BeTrue();

        var filePath = Path.Combine(jobDir, "0.bin");
        File.WriteAllBytes(filePath, [1]);

        using (var handle = File.Open(filePath, FileMode.Open, FileAccess.Read, FileShare.None))
        {
            var act = () => store.PurgeJob("job-1");

            act.Should().NotThrow();
        }

        log.Received(1).InternalWarning(Arg.Any<string>());
        store.BytesInUse.Should().Be(0);
    }

    [Fact]
    public void SweepAll_ClearsDirectoryContentsAndReservations()
    {
        var (store, root) = NewStore(maxScratchBytes: 100);
        store.EnsureJobDirectory("job-1");
        store.TryReserve("job-1", 40).Should().BeTrue();
        store.EnsureJobDirectory("job-2");
        store.TryReserve("job-2", 30).Should().BeTrue();

        store.SweepAll();

        Directory.Exists(root).Should().BeTrue();
        Directory.EnumerateFileSystemEntries(root).Should().BeEmpty();
        store.BytesInUse.Should().Be(0);
        store.TryReserve("job-1", 100).Should().BeTrue();
    }

    [Fact]
    public void SweepAll_MissingScratchRoot_IsNoOp()
    {
        var missingRoot = Path.Combine(Path.GetTempPath(), $"teensyrom-scratch-missing-{Guid.NewGuid():N}");
        var store = new TransferScratchStore(
            new TransferOptions { ScratchRoot = missingRoot }, Substitute.For<ILoggingService>());

        var act = () => store.SweepAll();

        act.Should().NotThrow();
        Directory.Exists(missingRoot).Should().BeFalse();
    }

    [Fact]
    public void NewScratchFilePath_SecondCallForSameJob_UsesNextMonotonicOpaqueName()
    {
        var (store, root) = NewStore(maxScratchBytes: 100);

        var first = store.NewScratchFilePath("job-1");
        var second = store.NewScratchFilePath("job-1");

        first.Should().Be(Path.Combine(root, "job-1", "0.bin"));
        second.Should().Be(Path.Combine(root, "job-1", "1.bin"));
    }

    [Fact]
    public void ScratchRoot_DiffersFromStagingRoot_WithDefaults()
    {
        var options = new TransferOptions();

        options.ScratchRoot.Should().NotBe(options.StagingRoot);
    }

    private (TransferScratchStore Store, string Root) NewStore(long maxScratchBytes)
    {
        var root = Directory.CreateTempSubdirectory("teensyrom-scratch-tests-").FullName;
        _roots.Add(root);

        var options = new TransferOptions { ScratchRoot = root, MaxScratchBytes = maxScratchBytes };
        return (new TransferScratchStore(options, Substitute.For<ILoggingService>()), root);
    }

    public void Dispose()
    {
        foreach (var root in _roots.Where(Directory.Exists))
        {
            Directory.Delete(root, recursive: true);
        }
    }
}
