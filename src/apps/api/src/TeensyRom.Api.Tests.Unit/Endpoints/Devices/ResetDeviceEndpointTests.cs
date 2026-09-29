using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.ResetDevice;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Commands;
using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Devices;

public class ResetDeviceEndpointTests
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
    public async Task Handle_ResetSucceeds_SendsOk()
    {
        GivenDevice();
        _mediator.Send(Arg.Any<ResetCommand>(), Arg.Any<CancellationToken>()).Returns(new ResetResult());
        var endpoint = EndpointFactory.CreateEndpoint<ResetDeviceEndpoint>(_deviceManager, _mediator);

        await endpoint.Handle(new ResetDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Handle_ResetCommandFails_SendsTheFailureInsteadOfOk()
    {
        GivenDevice();
        _mediator.Send(Arg.Any<ResetCommand>(), Arg.Any<CancellationToken>())
            .Returns(new ResetResult { IsSuccess = false, Error = "Unable to connect to COM7" });
        var endpoint = EndpointFactory.CreateEndpoint<ResetDeviceEndpoint>(_deviceManager, _mediator);

        await endpoint.Handle(new ResetDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadGateway);
        endpoint.GetResult<ProblemHttpResult>().ProblemDetails.Title.Should().Be("Unable to connect to COM7");
    }
}
