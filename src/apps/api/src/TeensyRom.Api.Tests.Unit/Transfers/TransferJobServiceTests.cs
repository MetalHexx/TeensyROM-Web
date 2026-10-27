using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Transfers;
using TeensyRom.Api.Transfers.Archives;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Entities.Transfers;
using TeensyRom.Core.Logging;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class TransferJobServiceTests : IDisposable
{
    private const string DeviceId = "ABCD2345";

    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly ITransferJobRegistry _registry = Substitute.For<ITransferJobRegistry>();
    private readonly IDeviceLeaseCoordinator _leases = Substitute.For<IDeviceLeaseCoordinator>();
    private readonly ITransferAdmission _admission = Substitute.For<ITransferAdmission>();
    private readonly ITransferScratchStore _scratch = Substitute.For<ITransferScratchStore>();
    private readonly IArchiveReader _archiveReader = Substitute.For<IArchiveReader>();
    private readonly IArchiveExpansionQueue _expansionQueue = Substitute.For<IArchiveExpansionQueue>();
    private readonly ITransferProgressNotifier _notifier = Substitute.For<ITransferProgressNotifier>();
    private readonly string _tempDir = Directory.CreateTempSubdirectory("teensyrom-job-service-tests-").FullName;

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    private TransferJobService NewService()
    {
        // TransferPump is a concrete singleton, so a real one is built over substitutes.
        var pump = new TransferPump(
            Substitute.For<ITransferQueue>(), _registry, _leases, Substitute.For<ITransferCapacityGate>(),
            Substitute.For<ITransferStagingStore>(), _scratch, _admission, _deviceManager,
            Substitute.For<IServiceScopeFactory>(), _notifier, Substitute.For<ITransferAutoLauncher>(), new TransferOptions(), Substitute.For<ILoggingService>());

        return new TransferJobService(
            _deviceManager, _registry, _leases, _admission, _scratch, _archiveReader, _expansionQueue, _notifier, pump);
    }

    private static TransferJob NewJob() =>
        new(DeviceId, TeensyStorageType.SD, new DirectoryPath("/transfers"), new TransferOptions());

    private static TransferJobStart NewStart(
        string destination = "/music/incoming", TeensyStorageType storage = TeensyStorageType.SD, TransferOrigin? origin = null) =>
        new(DeviceId, storage, destination, 0, origin ?? TransferOrigin.Upload);

    private void GivenDevice(bool sdAvailable = true, bool usbAvailable = true)
    {
        var cart = new Cart { DeviceId = DeviceId };
        cart.SdStorage.Available = sdAvailable;
        cart.UsbStorage.Available = usbAvailable;
        var device = new TeensyRomDevice(
            cart, Substitute.For<ICommunicationPort>(), Substitute.For<IStorageService>(), Substitute.For<IStorageService>());
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
    }

    private void GivenRegistryCreates(TransferJob job) =>
        _registry.Create(DeviceId, Arg.Any<TeensyStorageType>(), Arg.Any<DirectoryPath>(), Arg.Any<int>(), Arg.Any<TransferOrigin?>())
            .Returns(job);

    [Fact]
    public void Start_UnknownDevice_ReturnsDeviceNotFound()
    {
        var result = NewService().Start(NewStart());

        result.Started.Should().BeFalse();
        result.Error.Should().Be(TransferStartError.DeviceNotFound);
        result.Message.Should().Be($"The device {DeviceId} was not found.");
        _registry.DidNotReceiveWithAnyArgs().Create(default!, default, default!, default, default);
    }

    [Theory]
    [InlineData(TeensyStorageType.SD, "The device ABCD2345 does not have an SD card.")]
    [InlineData(TeensyStorageType.USB, "The device ABCD2345 does not have USB storage.")]
    public void Start_StorageNotAvailable_ReturnsStorageUnavailable(TeensyStorageType storage, string message)
    {
        GivenDevice(sdAvailable: false, usbAvailable: false);

        var result = NewService().Start(NewStart(storage: storage));

        result.Error.Should().Be(TransferStartError.StorageUnavailable);
        result.Message.Should().Be(message);
    }

    [Fact]
    public void Start_InvalidDestination_ReturnsInvalidDestinationWithoutCreatingAJob()
    {
        GivenDevice();

        var result = NewService().Start(NewStart(destination: "C:\\not\\unix"));

        result.Error.Should().Be(TransferStartError.InvalidDestination);
        result.Message.Should().NotBeNullOrEmpty();
        _registry.DidNotReceiveWithAnyArgs().Create(default!, default, default!, default, default);
    }

    [Fact]
    public void Start_LeaseHeldByAnotherJob_RemovesJobAndNamesHolder()
    {
        GivenDevice();
        var job = NewJob();
        GivenRegistryCreates(job);
        _leases.TryAcquire(DeviceId, job.JobId).Returns(false);
        _leases.GetHolder(DeviceId).Returns("holder-job");

        var result = NewService().Start(NewStart());

        result.Started.Should().BeFalse();
        result.Error.Should().Be(TransferStartError.DeviceBusy);
        result.ActiveJobId.Should().Be("holder-job");
        result.Message.Should().Be($"Device {DeviceId} already has an active transfer (job holder-job).");
        _registry.Received(1).Remove(job.JobId);
        _notifier.DidNotReceiveWithAnyArgs().JobChanged(default!);
    }

    [Fact]
    public void Start_LeaseAcquired_ReturnsJobAndNotifiesOnce()
    {
        GivenDevice();
        var origin = TransferOrigin.FromWatchFolder("wf-1", "/watch");
        var job = NewJob();
        GivenRegistryCreates(job);
        _leases.TryAcquire(DeviceId, job.JobId).Returns(true);

        var result = NewService().Start(NewStart(origin: origin));

        result.Started.Should().BeTrue();
        result.Job.Should().BeSameAs(job);
        _registry.Received(1).Create(DeviceId, TeensyStorageType.SD, Arg.Any<DirectoryPath>(), 0, origin);
        _notifier.Received(1).JobChanged(job);
    }

    [Fact]
    public void Discard_ReleasesLeaseAndRemovesJob()
    {
        var job = NewJob();

        NewService().Discard(job);

        _leases.Received(1).Release(DeviceId, job.JobId);
        _registry.Received(1).Remove(job.JobId);
    }

    [Fact]
    public async Task AddFileAsync_TerminalJob_IsRefusedWithoutAdmission()
    {
        var job = NewJob();
        job.TryTransitionTo(TransferJobState.Cancelled);

        var result = await NewService().AddFileAsync(job, Stream.Null, "a.prg", 10, CancellationToken.None);

        result.Accepted.Should().BeFalse();
        result.Error.Should().Be($"Job {job.JobId} is not accepting files in its current state (Cancelled).");
        await _admission.DidNotReceiveWithAnyArgs().AdmitAsync(default!, default!, default!, default, default, default);
    }

    [Fact]
    public async Task AddFileAsync_OrdinaryFile_GoesThroughAdmissionWithSizeHint()
    {
        var job = NewJob();
        var staged = new StagedFile(job.JobId, "stage", "a.prg", new FilePath("/transfers/a.prg"), TeensyStorageType.SD, 42, 42);
        _admission.AdmitAsync(job, Arg.Any<Stream>(), "a.prg", 100, true, Arg.Any<CancellationToken>())
            .Returns(new AdmissionResult(staged, null));

        var result = await NewService().AddFileAsync(job, Stream.Null, "a.prg", 100, CancellationToken.None);

        result.Should().Be(new TransferFileResult(true, 42, null));
        await _expansionQueue.DidNotReceiveWithAnyArgs().EnqueueAsync(default!, default);
    }

    [Fact]
    public async Task AddFileAsync_AdmissionRejects_ReturnsTheAdmissionError()
    {
        var job = NewJob();
        _admission.AdmitAsync(job, Arg.Any<Stream>(), "../a.prg", Arg.Any<long>(), true, Arg.Any<CancellationToken>())
            .Returns(new AdmissionResult(null, "bad path"));

        var result = await NewService().AddFileAsync(job, Stream.Null, "../a.prg", null, CancellationToken.None);

        result.Should().Be(new TransferFileResult(false, 0, "bad path"));
    }

    [Fact]
    public async Task AddFileAsync_NoSizeHint_ReservesOneMegabyte()
    {
        var job = NewJob();
        _admission.AdmitAsync(job, Arg.Any<Stream>(), "a.prg", Arg.Any<long>(), true, Arg.Any<CancellationToken>())
            .Returns(new AdmissionResult(null, "nope"));

        await NewService().AddFileAsync(job, Stream.Null, "a.prg", null, CancellationToken.None);

        await _admission.Received(1).AdmitAsync(job, Arg.Any<Stream>(), "a.prg", 1024 * 1024, true, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddFileAsync_Archive_RoutesToScratchAndExpansionQueueNotAdmission()
    {
        var job = NewJob();
        var scratchPath = Path.Combine(_tempDir, "archive.bin");
        _archiveReader.IsArchiveExtension("pack.zip").Returns(true);
        _scratch.TryReserve(job.JobId, 100).Returns(true);
        _scratch.NewScratchFilePath(job.JobId).Returns(scratchPath);
        _scratch.Adjust(job.JobId, 100, 5).Returns(5L);
        using var body = new MemoryStream([1, 2, 3, 4, 5]);

        var result = await NewService().AddFileAsync(job, body, "pack.zip", 100, CancellationToken.None);

        result.Should().Be(new TransferFileResult(true, 5, null));
        File.ReadAllBytes(scratchPath).Should().Equal(1, 2, 3, 4, 5);
        await _expansionQueue.Received(1).EnqueueAsync(
            Arg.Is<ArchiveExpansionRequest>(r => r.JobId == job.JobId && r.ScratchArchivePath == scratchPath && r.ArchiveRelativePath == "pack.zip" && r.RawReservedBytes == 5),
            Arg.Any<CancellationToken>());
        await _admission.DidNotReceiveWithAnyArgs().AdmitAsync(default!, default!, default!, default, default, default);
    }

    [Fact]
    public async Task AddFileAsync_ArchiveWithoutScratchRoom_IsRefused()
    {
        var job = NewJob();
        _archiveReader.IsArchiveExtension("pack.zip").Returns(true);
        _scratch.TryReserve(job.JobId, Arg.Any<long>()).Returns(false);

        var result = await NewService().AddFileAsync(job, Stream.Null, "pack.zip", 100, CancellationToken.None);

        result.Should().Be(new TransferFileResult(false, 0, "Insufficient scratch space to accept this archive."));
    }

    [Fact]
    public void Seal_FromCreated_PassesThroughReceivingAndCompletesWhenNothingPending()
    {
        var job = NewJob();

        var result = NewService().Seal(job);

        result.Should().Be(new TransferSealResult(true, null));
        job.State.Should().Be(TransferJobState.Completed);
    }

    [Fact]
    public void Seal_TerminalJob_IsRefused()
    {
        var job = NewJob();
        job.TryTransitionTo(TransferJobState.Cancelled);

        var result = NewService().Seal(job);

        result.Sealed.Should().BeFalse();
        result.Error.Should().Be($"Job {job.JobId} cannot be sealed from its current state (Cancelled).");
    }
}
