using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.ForgetDevice;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Devices;

public class ForgetDeviceEndpointTests
{
    private const string DeviceId = "ABCD2345";
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();

    [Fact]
    public async Task Handle_Forgotten_SendsOk()
    {
        _deviceManager.ForgetAsync(DeviceId, Arg.Any<CancellationToken>()).Returns(ForgetResult.Forgotten);
        var endpoint = EndpointFactory.CreateEndpoint<ForgetDeviceEndpoint>(_deviceManager);

        await endpoint.Handle(new ForgetDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Handle_StillAvailable_SendsConflict()
    {
        _deviceManager.ForgetAsync(DeviceId, Arg.Any<CancellationToken>()).Returns(ForgetResult.StillAvailable);
        var endpoint = EndpointFactory.CreateEndpoint<ForgetDeviceEndpoint>(_deviceManager);

        await endpoint.Handle(new ForgetDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Handle_UnknownDevice_SendsNotFound()
    {
        _deviceManager.ForgetAsync(DeviceId, Arg.Any<CancellationToken>()).Returns(ForgetResult.UnknownDevice);
        var endpoint = EndpointFactory.CreateEndpoint<ForgetDeviceEndpoint>(_deviceManager);

        await endpoint.Handle(new ForgetDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
    }
}
