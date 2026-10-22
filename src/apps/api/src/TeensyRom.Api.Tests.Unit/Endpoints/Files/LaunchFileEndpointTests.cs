using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.Player.LaunchFile;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Files;

public class LaunchFileEndpointTests
{
    private const string DeviceId = "ABCD2345";
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IStorageService _sdStorage = Substitute.For<IStorageService>();

    private LaunchFileEndpoint GivenDevice()
    {
        var cart = new Cart
        {
            DeviceId = DeviceId,
            SdStorage = new CartStorage(TeensyStorageType.SD, true),
            UsbStorage = new CartStorage(TeensyStorageType.USB, false)
        };
        var device = new TeensyRomDevice(cart, Substitute.For<ICommunicationPort>(), _sdStorage, Substitute.For<IStorageService>());
        _deviceManager.GetAvailableDevice(DeviceId).Returns(device);
        return EndpointFactory.CreateEndpoint<LaunchFileEndpoint>(Substitute.For<IMediator>(), _deviceManager);
    }

    private static LaunchFileRequest Request() => new() { DeviceId = DeviceId, StorageType = TeensyStorageType.SD, FilePath = "/music/tune.sid" };

    [Fact]
    public async Task Handle_ParentDirectoryReadFailed_SendsBadGatewayWithTheFailureNotFileNotFound()
    {
        var endpoint = GivenDevice();
        _sdStorage.LookupFile(Arg.Any<FilePath>()).Returns(FileLookupResult.Failed("The link dropped."));

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadGateway);
        endpoint.GetResult<ProblemHttpResult>().ProblemDetails.Title.Should().Be("The link dropped.");
    }

    [Fact]
    public async Task Handle_FileNotFound_SendsNotFound()
    {
        var endpoint = GivenDevice();
        _sdStorage.LookupFile(Arg.Any<FilePath>()).Returns(FileLookupResult.NotFound());

        await endpoint.Handle(Request(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
    }
}
