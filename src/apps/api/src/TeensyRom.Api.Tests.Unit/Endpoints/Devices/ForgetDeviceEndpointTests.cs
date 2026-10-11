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
    private readonly IDeviceSettingsProvider _settingsProvider = Substitute.For<IDeviceSettingsProvider>();

    [Fact]
    public async Task Handle_Forgotten_SendsOkAndRemovesTheSettingsEntry()
    {
        _deviceManager.ForgetAsync(DeviceId, Arg.Any<CancellationToken>()).Returns(ForgetResult.Forgotten);
        var endpoint = EndpointFactory.CreateEndpoint<ForgetDeviceEndpoint>(_deviceManager, _settingsProvider);

        await endpoint.Handle(new ForgetDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        _settingsProvider.Received(1).RemoveDeviceSettings(DeviceId);
    }

    [Fact]
    public async Task Handle_StillAvailable_SendsConflict()
    {
        _deviceManager.ForgetAsync(DeviceId, Arg.Any<CancellationToken>()).Returns(ForgetResult.StillAvailable);
        var endpoint = EndpointFactory.CreateEndpoint<ForgetDeviceEndpoint>(_deviceManager, _settingsProvider);

        await endpoint.Handle(new ForgetDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.Conflict);
        _settingsProvider.DidNotReceive().RemoveDeviceSettings(Arg.Any<string>());
    }

    [Fact]
    public async Task Handle_UnknownDevice_SendsNotFound()
    {
        _deviceManager.ForgetAsync(DeviceId, Arg.Any<CancellationToken>()).Returns(ForgetResult.UnknownDevice);
        var endpoint = EndpointFactory.CreateEndpoint<ForgetDeviceEndpoint>(_deviceManager, _settingsProvider);

        await endpoint.Handle(new ForgetDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
        _settingsProvider.DidNotReceive().RemoveDeviceSettings(Arg.Any<string>());
    }
}
