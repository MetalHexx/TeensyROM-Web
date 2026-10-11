using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.ReconnectDevice;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Devices;

public class ReconnectDeviceEndpointTests
{
    private const string DeviceId = "ABCD2345";
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IDeviceSettingsProvider _settingsProvider = Substitute.For<IDeviceSettingsProvider>();

    private static TeensyRomDevice GivenDevice() =>
        new(
            new Cart { DeviceId = DeviceId },
            Substitute.For<ICommunicationPort>(),
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>());

    [Theory]
    [InlineData(ReconnectResult.Reconnected)]
    [InlineData(ReconnectResult.AlreadyAvailable)]
    public async Task Handle_ReconnectedOrAlreadyAvailable_SendsOkWithDevice(ReconnectResult result)
    {
        var device = GivenDevice();
        _deviceManager.ReconnectAsync(DeviceId, Arg.Any<CancellationToken>())
            .Returns(new ReconnectOutcome(result, device));
        var endpoint = EndpointFactory.CreateEndpoint<ReconnectDeviceEndpoint>(_deviceManager, _settingsProvider);

        await endpoint.Handle(new ReconnectDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response!.Device.DeviceId.Should().Be(DeviceId);
    }

    [Fact]
    public async Task Handle_NotFound_SendsBadGateway()
    {
        _deviceManager.ReconnectAsync(DeviceId, Arg.Any<CancellationToken>())
            .Returns(new ReconnectOutcome(ReconnectResult.NotFound, null));
        var endpoint = EndpointFactory.CreateEndpoint<ReconnectDeviceEndpoint>(_deviceManager, _settingsProvider);

        await endpoint.Handle(new ReconnectDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadGateway);
    }

    [Fact]
    public async Task Handle_UnknownDevice_SendsNotFound()
    {
        _deviceManager.ReconnectAsync(DeviceId, Arg.Any<CancellationToken>())
            .Returns(new ReconnectOutcome(ReconnectResult.UnknownDevice, null));
        var endpoint = EndpointFactory.CreateEndpoint<ReconnectDeviceEndpoint>(_deviceManager, _settingsProvider);

        await endpoint.Handle(new ReconnectDeviceRequest { DeviceId = DeviceId }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
    }
}
