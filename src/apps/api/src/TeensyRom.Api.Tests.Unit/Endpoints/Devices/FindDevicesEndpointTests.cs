using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.FindCarts;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Devices;

public class FindDevicesEndpointTests
{
    private const string OnlineDeviceId = "ONLINE001";
    private const string OfflineDeviceId = "OFFLINE01";
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IDeviceSettingsProvider _settingsProvider = Substitute.For<IDeviceSettingsProvider>();

    private static TeensyRomDevice OnlineDevice() =>
        new(
            new Cart { DeviceId = OnlineDeviceId },
            Substitute.For<ICommunicationPort>(),
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>());

    private static OfflineDevice OfflineDevice() =>
        new(OfflineDeviceId, "COM3", null, ConnectionType.Serial, "1.0.0", HardwareVariant.TeensyRom, true, "TR-1");

    [Fact]
    public async Task Handle_OnlineAndOffline_ListsOnlineFirstThenOffline()
    {
        var onlineDevices = new List<TeensyRomDevice> { OnlineDevice() };
        var offlineDevices = new List<OfflineDevice> { OfflineDevice() };
        _deviceManager.FindDevices(false, Arg.Any<CancellationToken>(), false).Returns(onlineDevices);
        _deviceManager.GetOfflineDevices().Returns(offlineDevices);
        var endpoint = EndpointFactory.CreateEndpoint<FindDevicesEndpoint>(_deviceManager, _settingsProvider);

        await endpoint.Handle(new FindDevicesRequest(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response!.Devices.Select(d => d.DeviceId).Should().Equal(OnlineDeviceId, OfflineDeviceId);
    }

    [Fact]
    public async Task Handle_OnlyOffline_SendsOk()
    {
        var offlineDevices = new List<OfflineDevice> { OfflineDevice() };
        _deviceManager.FindDevices(false, Arg.Any<CancellationToken>(), false).Returns([]);
        _deviceManager.GetOfflineDevices().Returns(offlineDevices);
        var endpoint = EndpointFactory.CreateEndpoint<FindDevicesEndpoint>(_deviceManager, _settingsProvider);

        await endpoint.Handle(new FindDevicesRequest(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response!.Devices.Should().ContainSingle(d => d.DeviceId == OfflineDeviceId);
    }

    [Fact]
    public async Task Handle_NoneKnown_SendsNotFound()
    {
        _deviceManager.FindDevices(false, Arg.Any<CancellationToken>(), false).Returns([]);
        _deviceManager.GetOfflineDevices().Returns([]);
        var endpoint = EndpointFactory.CreateEndpoint<FindDevicesEndpoint>(_deviceManager, _settingsProvider);

        await endpoint.Handle(new FindDevicesRequest(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
    }
}
