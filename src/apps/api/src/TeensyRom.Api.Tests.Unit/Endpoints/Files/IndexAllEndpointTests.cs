using Microsoft.AspNetCore.Http.HttpResults;
using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.Files.IndexAll;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Files;

public class IndexAllEndpointTests
{
    private const string BusyDeviceId = "BUSY0001";
    private const string FreeDeviceId = "FREE0001";
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IDeviceSettingsProvider _settingsProvider = Substitute.For<IDeviceSettingsProvider>();
    private readonly IDeviceTransferLease _lease = Substitute.For<IDeviceTransferLease>();
    private readonly IStorageService _busySd = Substitute.For<IStorageService>();
    private readonly IStorageService _freeSd = Substitute.For<IStorageService>();

    public IndexAllEndpointTests()
    {
        _lease.GetActiveJobId(Arg.Any<string>()).Returns((string?)null);
        _lease.GetActiveJobId(BusyDeviceId).Returns(LeaseDoubles.JobId);
        _settingsProvider.GetOrCreateDeviceSettings(Arg.Any<string>()).Returns(call => new DeviceSettings { DeviceId = call.Arg<string>() });
        _freeSd.CacheAll(Arg.Any<CancellationToken>()).Returns(true);
    }

    private static TeensyRomDevice Device(string id, IStorageService sd) => new(
        new Cart
        {
            DeviceId = id,
            SdStorage = new CartStorage(TeensyStorageType.SD, true),
            UsbStorage = new CartStorage(TeensyStorageType.USB, false)
        },
        Substitute.For<ICommunicationPort>(),
        sd,
        Substitute.For<IStorageService>());

    private IndexAllEndpoint NewEndpoint(params TeensyRomDevice[] devices)
    {
        _deviceManager.GetAvailableDevices().Returns([.. devices]);
        return EndpointFactory.CreateEndpoint<IndexAllEndpoint>(_deviceManager, _lease, _settingsProvider);
    }

    [Fact]
    public async Task Handle_OneBusyDevice_SkipsItIndexesTheOthersAndSendsConflictListingIt()
    {
        var endpoint = NewEndpoint(Device(BusyDeviceId, _busySd), Device(FreeDeviceId, _freeSd));

        await endpoint.Handle(CancellationToken.None);

        await _busySd.DidNotReceive().CacheAll(Arg.Any<CancellationToken>());
        await _freeSd.Received(1).CacheAll(Arg.Any<CancellationToken>());
        endpoint.GetStatusCode().Should().Be(HttpStatusCode.Conflict);
        var problem = endpoint.GetProblem<ProblemHttpResult>();
        problem.ShouldBeDeviceBusy(BusyDeviceId);
        problem.ProblemDetails.Detail.Should().Be("The other devices were indexed.");
        problem.ProblemDetails.Extensions["busyDeviceIds"].Should().BeEquivalentTo(new[] { BusyDeviceId });
    }

    [Fact]
    public async Task Handle_BusyDeviceAndAFailingFreeDevice_KeepsTheIndexingFailureAndListsTheBusyDevice()
    {
        _freeSd.CacheAll(Arg.Any<CancellationToken>()).Returns(false);
        var endpoint = NewEndpoint(Device(BusyDeviceId, _busySd), Device(FreeDeviceId, _freeSd));

        await endpoint.Handle(CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.InternalServerError);
        var problem = endpoint.GetProblem<ProblemHttpResult>();
        problem.ProblemDetails.Extensions["busyDeviceIds"].Should().BeEquivalentTo(new[] { BusyDeviceId });
        problem.ProblemDetails.Extensions.Should().ContainKey(FreeDeviceId);
        await _busySd.DidNotReceive().CacheAll(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_NoBusyDevice_IndexesEverythingAndSendsOk()
    {
        var endpoint = NewEndpoint(Device(FreeDeviceId, _freeSd));

        await endpoint.Handle(CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
    }
}
