using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.Common;
using TeensyRom.Api.Endpoints.LaunchAsidPlayer;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Serial.Commands.LaunchAsidPlayer;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Devices;

public class LaunchAsidPlayerEndpointTests
{
    private const string DeviceId = "ABCD2345";
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IMediator _mediator = Substitute.For<IMediator>();

    private void GivenDevice()
    {
        var device = new TeensyRomDevice(
            new Cart { DeviceId = DeviceId },
            Substitute.For<ICommunicationPort>(),
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>());
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
    }

    private void GivenResult(LaunchAsidPlayerResult result) =>
        _mediator.Send(Arg.Any<LaunchAsidPlayerCommand>(), Arg.Any<CancellationToken>()).Returns(result);

    private async Task<LaunchAsidPlayerEndpoint> WhenLaunched()
    {
        var endpoint = EndpointFactory.CreateEndpoint<LaunchAsidPlayerEndpoint>(_deviceManager, _mediator);
        await endpoint.Handle(new LaunchAsidPlayerRequest { DeviceId = DeviceId }, CancellationToken.None);
        return endpoint;
    }

    [Fact]
    public async Task Handle_LaunchSucceeds_SendsOkWithWhetherTheDeviceMoved()
    {
        GivenDevice();
        GivenResult(new LaunchAsidPlayerResult { MovedToSerial = true });

        var endpoint = await WhenLaunched();

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response.MovedToSerial.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_UnknownDevice_SendsNotFound()
    {
        var endpoint = await WhenLaunched();

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Handle_DeviceBusyWithTransfer_SendsTheSharedConflict()
    {
        GivenDevice();
        GivenResult(new LaunchAsidPlayerResult { IsSuccess = false, Error = "busy", ActiveTransferJobId = LeaseDoubles.JobId });

        var endpoint = await WhenLaunched();

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.Conflict);
        endpoint.GetProblem<ProblemHttpResult>().ShouldBeDeviceBusy(DeviceId);
    }

    [Fact]
    public async Task Handle_UsbUnreachable_SendsBadGatewayWithTheUsbUnreachableCode()
    {
        GivenDevice();
        GivenResult(new LaunchAsidPlayerResult { IsSuccess = false, UsbUnreachable = true, Error = "no usb" });

        var endpoint = await WhenLaunched();

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadGateway);
        var problem = endpoint.GetProblem<ProblemHttpResult>();
        problem.ProblemDetails.Extensions["code"].Should().Be(UsbUnreachableProblem.Code);
    }

    [Fact]
    public async Task Handle_LaunchFails_SendsBadGatewayWithTheError()
    {
        GivenDevice();
        GivenResult(new LaunchAsidPlayerResult { IsSuccess = false, Error = "did not start" });

        var endpoint = await WhenLaunched();

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadGateway);
        endpoint.GetResult<ProblemHttpResult>().ProblemDetails.Title.Should().Be("did not start");
        endpoint.GetResult<ProblemHttpResult>().ProblemDetails.Extensions.Should().NotContainKey("movedToSerial");
    }

    [Fact]
    public async Task Handle_LaunchFailsAfterTheDeviceMoved_SendsBadGatewayFlaggedAsMoved()
    {
        GivenDevice();
        GivenResult(new LaunchAsidPlayerResult { IsSuccess = false, MovedToSerial = true, Error = "did not start" });

        var endpoint = await WhenLaunched();

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadGateway);
        var problem = endpoint.GetProblem<ProblemHttpResult>().ProblemDetails;
        problem.Title.Should().Be("did not start");
        problem.Extensions["movedToSerial"].Should().Be(true);
    }
}
