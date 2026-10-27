using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.Player.ToggleMusic;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Serial.Commands.ToggleMusic;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Devices;

public class ToggleMusicEndpointTests
{
    private const string DeviceId = "ABCD2345";
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IMediator _mediator = Substitute.For<IMediator>();

    private ToggleMusicEndpoint GivenDevice()
    {
        var device = new TeensyRomDevice(
            new Cart { DeviceId = DeviceId },
            Substitute.For<ICommunicationPort>(),
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>());
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        return EndpointFactory.CreateEndpoint<ToggleMusicEndpoint>(_mediator, _deviceManager);
    }

    [Fact]
    public async Task Handle_DeviceBusyWithTransfer_SendsTheSharedConflict()
    {
        var endpoint = GivenDevice();
        _mediator.Send(Arg.Any<ToggleMusicCommand>(), Arg.Any<CancellationToken>())
            .Returns(new ToggleMusicResult { IsSuccess = false, Error = "busy", ActiveTransferJobId = LeaseDoubles.JobId });

        await endpoint.Handle(new ToggleMusicRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.Conflict);
        endpoint.GetProblem<ProblemHttpResult>().ShouldBeDeviceBusy(DeviceId);
    }

    [Fact]
    public async Task Handle_OtherFailure_StillSendsBadGateway()
    {
        var endpoint = GivenDevice();
        _mediator.Send(Arg.Any<ToggleMusicCommand>(), Arg.Any<CancellationToken>())
            .Returns(new ToggleMusicResult { IsSuccess = false, Error = "No answer." });

        await endpoint.Handle(new ToggleMusicRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadGateway);
    }
}
