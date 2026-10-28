using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.Files.Index;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Files;

public class IndexEndpointTests
{
    private const string DeviceId = "ABCD2345";
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IDeviceSettingsProvider _settingsProvider = Substitute.For<IDeviceSettingsProvider>();
    private readonly IStorageService _sdStorage = Substitute.For<IStorageService>();

    private IndexEndpoint GivenDevice(IDeviceTransferLease lease)
    {
        var cart = new Cart
        {
            DeviceId = DeviceId,
            SdStorage = new CartStorage(TeensyStorageType.SD, true),
            UsbStorage = new CartStorage(TeensyStorageType.USB, false)
        };
        var device = new TeensyRomDevice(cart, Substitute.For<ICommunicationPort>(), _sdStorage, Substitute.For<IStorageService>());
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        return EndpointFactory.CreateEndpoint<IndexEndpoint>(_deviceManager, lease, _settingsProvider);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("/music")]
    public async Task Handle_DeviceBusyWithTransfer_SendsConflictAndNeverTouchesTheCache(string? startingPath)
    {
        var endpoint = GivenDevice(LeaseDoubles.Busy());

        await endpoint.Handle(
            new IndexRequest { DeviceId = DeviceId, StorageType = TeensyStorageType.SD, StartingPath = startingPath },
            CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.Conflict);
        endpoint.GetProblem<ProblemHttpResult>().ShouldBeDeviceBusy(DeviceId);
        await _sdStorage.DidNotReceive().CacheAll(Arg.Any<CancellationToken>());
        await _sdStorage.DidNotReceive().Cache(Arg.Any<DirectoryPath>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_FreeDevice_IndexesIt()
    {
        var endpoint = GivenDevice(LeaseDoubles.Free());
        _sdStorage.CacheAll(Arg.Any<CancellationToken>()).Returns(true);
        _settingsProvider.GetOrCreateDeviceSettings(DeviceId).Returns(new TeensyRom.Core.Settings.DeviceSettings { DeviceId = DeviceId });

        await endpoint.Handle(
            new IndexRequest { DeviceId = DeviceId, StorageType = TeensyStorageType.SD },
            CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        await _sdStorage.Received(1).CacheAll(Arg.Any<CancellationToken>());
    }
}
