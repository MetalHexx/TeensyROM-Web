using MediatR;
using Microsoft.Extensions.DependencyInjection;
using TeensyRom.Api.Services;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands.LaunchFile;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Services;

public class FileLaunchServiceTests
{
    private const string DeviceId = "ABCD2345";
    private static readonly FilePath TunePath = new("/music/tune.sid");

    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IStorageService _sdStorage = Substitute.For<IStorageService>();
    private readonly IMediator _mediator = Substitute.For<IMediator>();

    private FileLaunchService NewService(bool deviceExists = true, bool sdAvailable = true, bool usbAvailable = false, IDeviceTransferLease? lease = null)
    {
        if (deviceExists)
        {
            var cart = new Cart
            {
                DeviceId = DeviceId,
                SdStorage = new CartStorage(TeensyStorageType.SD, sdAvailable),
                UsbStorage = new CartStorage(TeensyStorageType.USB, usbAvailable)
            };
            var device = new TeensyRomDevice(cart, Substitute.For<ICommunicationPort>(), _sdStorage, Substitute.For<IStorageService>());
            _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        }

        var scopeFactory = new ServiceCollection()
            .AddSingleton(_mediator)
            .BuildServiceProvider()
            .GetRequiredService<IServiceScopeFactory>();

        return new FileLaunchService(_deviceManager, lease ?? Endpoints.LeaseDoubles.Free(), scopeFactory);
    }

    private static Task<FileLaunchOutcome> Launch(FileLaunchService service, TeensyStorageType storage = TeensyStorageType.SD) =>
        service.LaunchAsync(DeviceId, storage, TunePath, CancellationToken.None);

    private void GivenLookup(FileLookupResult lookup) => _sdStorage.LookupFile(Arg.Any<FilePath>()).Returns(lookup);

    [Fact]
    public async Task LaunchAsync_UnknownDevice_ReturnsDeviceNotFound()
    {
        var outcome = await Launch(NewService(deviceExists: false));

        outcome.Status.Should().Be(FileLaunchStatus.DeviceNotFound);
    }

    [Theory]
    [InlineData(TeensyStorageType.SD)]
    [InlineData(TeensyStorageType.USB)]
    public async Task LaunchAsync_StorageNotPresent_ReturnsStorageUnavailable(TeensyStorageType storage)
    {
        var outcome = await Launch(NewService(sdAvailable: false, usbAvailable: false), storage);

        outcome.Status.Should().Be(FileLaunchStatus.StorageUnavailable);
    }

    [Fact]
    public async Task LaunchAsync_LookupFailure_ReturnsLookupFailedWithTheFailureAndSendsNothing()
    {
        GivenLookup(FileLookupResult.Failed("The link dropped."));

        var outcome = await Launch(NewService());

        outcome.Status.Should().Be(FileLaunchStatus.LookupFailed);
        outcome.Message.Should().Be("The link dropped.");
        await _mediator.DidNotReceiveWithAnyArgs().Send(default(LaunchFileCommand)!, default);
    }

    [Fact]
    public async Task LaunchAsync_MissingFile_ReturnsFileNotFound()
    {
        GivenLookup(FileLookupResult.NotFound());

        var outcome = await Launch(NewService());

        outcome.Status.Should().Be(FileLaunchStatus.FileNotFound);
    }

    [Fact]
    public async Task LaunchAsync_FileThatIsNotLaunchable_ReturnsNotLaunchable()
    {
        GivenLookup(FileLookupResult.Found(new FileItem()));

        var outcome = await Launch(NewService());

        outcome.Status.Should().Be(FileLaunchStatus.NotLaunchable);
    }

    [Theory]
    [InlineData(true, LaunchFileResultType.Success, FileLaunchStatus.Launched)]
    [InlineData(true, LaunchFileResultType.SidError, FileLaunchStatus.Incompatible)]
    [InlineData(false, LaunchFileResultType.SidError, FileLaunchStatus.Incompatible)]
    [InlineData(false, LaunchFileResultType.Success, FileLaunchStatus.LaunchFailed)]
    public async Task LaunchAsync_MapsTheLaunchResult(bool isSuccess, LaunchFileResultType resultType, FileLaunchStatus expected)
    {
        var item = new LaunchableItem();
        GivenLookup(FileLookupResult.Found(item));
        _mediator.Send(Arg.Any<LaunchFileCommand>(), Arg.Any<CancellationToken>())
            .Returns(new LaunchFileResult { IsSuccess = isSuccess, LaunchResult = resultType, Error = "no response" });

        var outcome = await Launch(NewService());

        outcome.Status.Should().Be(expected);

        if (expected is FileLaunchStatus.LaunchFailed)
        {
            outcome.Message.Should().Be("no response");
            outcome.Item.Should().BeNull();
        }
        else
        {
            outcome.Item.Should().BeSameAs(item);
        }
    }

    [Fact]
    public async Task LaunchAsync_LaunchRefusedAsBusy_ReturnsDeviceBusyNeverIncompatible()
    {
        GivenLookup(FileLookupResult.Found(new LaunchableItem()));
        _mediator.Send(Arg.Any<LaunchFileCommand>(), Arg.Any<CancellationToken>())
            .Returns(new LaunchFileResult
            {
                IsSuccess = false,
                LaunchResult = LaunchFileResultType.SidError,
                Error = "busy",
                ActiveTransferJobId = "job-1"
            });

        var outcome = await Launch(NewService());

        outcome.Status.Should().Be(FileLaunchStatus.DeviceBusy);
        outcome.ActiveJobId.Should().Be("job-1");
        outcome.DeviceName.Should().Be(DeviceNameOf());
        outcome.Item.Should().BeNull();
    }

    [Fact]
    public async Task LaunchAsync_LookupFailureWhileTheDeviceIsLeased_ReturnsDeviceBusy()
    {
        GivenLookup(FileLookupResult.Failed("refused"));

        var outcome = await Launch(NewService(lease: Endpoints.LeaseDoubles.Busy("job-2")));

        outcome.Status.Should().Be(FileLaunchStatus.DeviceBusy);
        outcome.ActiveJobId.Should().Be("job-2");
        await _mediator.DidNotReceiveWithAnyArgs().Send(default(LaunchFileCommand)!, default);
    }

    private string DeviceNameOf() => _deviceManager.GetAvailableDevice(DeviceId)!.Cart.Name;
}
