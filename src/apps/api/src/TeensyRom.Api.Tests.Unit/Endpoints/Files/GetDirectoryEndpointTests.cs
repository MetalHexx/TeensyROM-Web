using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.Files.GetDirectory;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Files;

public class GetDirectoryEndpointTests
{
    private const string DeviceId = "ABCD2345";
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IStorageService _sdStorage = Substitute.For<IStorageService>();

    private GetDirectoryEndpoint GivenDevice(IDeviceTransferLease? lease = null)
    {
        var cart = new Cart
        {
            DeviceId = DeviceId,
            SdStorage = new CartStorage(TeensyStorageType.SD, true),
            UsbStorage = new CartStorage(TeensyStorageType.USB, false)
        };
        var device = new TeensyRomDevice(cart, Substitute.For<ICommunicationPort>(), _sdStorage, Substitute.For<IStorageService>());
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        return EndpointFactory.CreateEndpoint<GetDirectoryEndpoint>(_deviceManager, lease ?? LeaseDoubles.Free());
    }

    private static GetDirectoryRequest Request() => new() { DeviceId = DeviceId, StorageType = TeensyStorageType.SD, Path = "/music/" };

    [Fact]
    public async Task Handle_ReadFailed_SendsBadGatewayWithTheFailureMessage()
    {
        var endpoint = GivenDevice();
        _sdStorage.ReadDirectory(Arg.Any<DirectoryPath>()).Returns(DirectoryReadResult.Failed("The link dropped."));

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadGateway);
        endpoint.GetResult<ProblemHttpResult>().ProblemDetails.Title.Should().Be("The link dropped.");
    }

    [Fact]
    public async Task Handle_DirectoryNotFound_SendsNotFound()
    {
        var endpoint = GivenDevice();
        _sdStorage.ReadDirectory(Arg.Any<DirectoryPath>()).Returns(DirectoryReadResult.NotFound());

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
        endpoint.GetResult<NotFound<string>>().Value.Should().Be("The directory /music/ was not found.");
    }

    [Fact]
    public async Task Handle_DirectoryFound_SendsOkWithTheListing()
    {
        var endpoint = GivenDevice();
        var item = new StorageCacheItem { Path = new DirectoryPath("/music/"), Directories = [], Files = [] };
        _sdStorage.ReadDirectory(Arg.Any<DirectoryPath>()).Returns(DirectoryReadResult.Found(item));

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response!.StorageItem.Should().NotBeNull();
    }

    [Fact]
    public async Task Handle_ReadFailedWhileDeviceBusy_SendsTheSharedConflictNotBadGateway()
    {
        var endpoint = GivenDevice(LeaseDoubles.Busy());
        _sdStorage.ReadDirectory(Arg.Any<DirectoryPath>()).Returns(DirectoryReadResult.Failed("busy"));

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.Conflict);
        endpoint.GetProblem<ProblemHttpResult>().ShouldBeDeviceBusy(DeviceId);
    }
}
