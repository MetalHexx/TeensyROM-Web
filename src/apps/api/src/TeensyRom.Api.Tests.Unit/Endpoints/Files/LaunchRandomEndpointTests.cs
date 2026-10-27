using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.Player.LaunchRandom;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands.LaunchFile;
using TeensyRom.Core.Settings;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Files;

public class LaunchRandomEndpointTests
{
    private const string DeviceId = "ABCD2345";
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IStorageService _sdStorage = Substitute.For<IStorageService>();
    private readonly IMediator _mediator = Substitute.For<IMediator>();

    private LaunchRandomEndpoint GivenDeviceWithRandomFile()
    {
        var cart = new Cart
        {
            DeviceId = DeviceId,
            SdStorage = new CartStorage(TeensyStorageType.SD, true),
            UsbStorage = new CartStorage(TeensyStorageType.USB, false)
        };
        var device = new TeensyRomDevice(cart, Substitute.For<ICommunicationPort>(), _sdStorage, Substitute.For<IStorageService>());
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        _sdStorage.GetRandomFile(Arg.Any<StorageScope>(), Arg.Any<DirectoryPath>(), Arg.Any<TeensyFilterType>())
            .Returns(new LaunchableItem { Name = "tune.sid", Path = new FilePath("/music/tune.sid") });
        return EndpointFactory.CreateEndpoint<LaunchRandomEndpoint>(_deviceManager, _mediator);
    }

    private static LaunchRandomRequest Request() => new() { DeviceId = DeviceId, StorageType = TeensyStorageType.SD };

    [Fact]
    public async Task Handle_LaunchRefusedAsBusy_SendsConflictNotAnIncompatibleLaunch()
    {
        var endpoint = GivenDeviceWithRandomFile();
        // A refused result carries the default LaunchResult, which would read as a failed (incompatible) launch.
        _mediator.Send(Arg.Any<LaunchFileCommand>(), Arg.Any<CancellationToken>())
            .Returns(new LaunchFileResult
            {
                IsSuccess = false,
                Error = "busy",
                LaunchResult = LaunchFileResultType.SidError,
                ActiveTransferJobId = LeaseDoubles.JobId
            });

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.Conflict);
        endpoint.GetProblem<ProblemHttpResult>().ShouldBeDeviceBusy(DeviceId);
    }

    [Fact]
    public async Task Handle_IncompatibleLaunchWithoutRefusal_StillSendsOk()
    {
        var endpoint = GivenDeviceWithRandomFile();
        _mediator.Send(Arg.Any<LaunchFileCommand>(), Arg.Any<CancellationToken>())
            .Returns(new LaunchFileResult { IsSuccess = false, LaunchResult = LaunchFileResultType.SidError });

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
    }
}
