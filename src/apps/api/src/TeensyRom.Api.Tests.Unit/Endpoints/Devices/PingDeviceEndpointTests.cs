using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.Serial.PingDevice;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Devices;

public class PingDeviceEndpointTests
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

    [Fact]
    public async Task Handle_PingSucceeds_SendsOk()
    {
        GivenDevice();
        _mediator.Send(Arg.Any<PingCommand>(), Arg.Any<CancellationToken>()).Returns(new PingResult());
        var endpoint = EndpointFactory.CreateEndpoint<PingDeviceEndpoint>(_deviceManager, _mediator);

        await endpoint.Handle(new PingDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Handle_PingSucceedsButBusy_StillSendsOk()
    {
        GivenDevice();
        _mediator.Send(Arg.Any<PingCommand>(), Arg.Any<CancellationToken>())
            .Returns(new PingResult { Response = "busy", IsBusy = true });
        var endpoint = EndpointFactory.CreateEndpoint<PingDeviceEndpoint>(_deviceManager, _mediator);

        await endpoint.Handle(new PingDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Handle_PingCommandFails_SendsTheFailureInsteadOfOk()
    {
        GivenDevice();
        _mediator.Send(Arg.Any<PingCommand>(), Arg.Any<CancellationToken>())
            .Returns(new PingResult { IsSuccess = false, Error = "Unable to connect to COM7" });
        var endpoint = EndpointFactory.CreateEndpoint<PingDeviceEndpoint>(_deviceManager, _mediator);

        await endpoint.Handle(new PingDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadGateway);
        endpoint.GetResult<ProblemHttpResult>().ProblemDetails.Title.Should().Be("Unable to connect to COM7");
    }

    [Fact]
    public async Task Handle_UnknownDevice_SendsNotFound()
    {
        var endpoint = EndpointFactory.CreateEndpoint<PingDeviceEndpoint>(_deviceManager, _mediator);

        await endpoint.Handle(new PingDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
    }
}
