using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.RenameDevice;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Entities.Device;
using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Devices;

public class RenameDeviceEndpointTests
{
    private const string DeviceId = "ABCD2345";
    private readonly IDeviceConnectionManager _deviceManager = Substitute.For<IDeviceConnectionManager>();
    private readonly IDeviceSettingsProvider _settingsProvider = Substitute.For<IDeviceSettingsProvider>();

    private static RenameDeviceRequest GivenRequest(string name = "Kitchen") =>
        new() { DeviceId = DeviceId, Body = new RenameDeviceBody { Name = name } };

    [Fact]
    public async Task Handle_RenamedAvailableDevice_SendsOkWithTheDevicesName()
    {
        var device = new TeensyRomDevice(
            new Cart { DeviceId = DeviceId, Name = "Kitchen" },
            Substitute.For<ICommunicationPort>(),
            Substitute.For<IStorageService>(),
            Substitute.For<IStorageService>());
        _deviceManager.RenameAsync(DeviceId, "Kitchen", Arg.Any<CancellationToken>())
            .Returns(new RenameOutcome(RenameResult.Renamed, device, null));
        var endpoint = EndpointFactory.CreateEndpoint<RenameDeviceEndpoint>(_deviceManager, _settingsProvider);

        await endpoint.Handle(GivenRequest(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response!.Device.DeviceId.Should().Be(DeviceId);
        endpoint.Response.Device.Name.Should().Be("Kitchen");
    }

    [Fact]
    public async Task Handle_RenamedOfflineDevice_SendsOkWithTheOfflineDevicesName()
    {
        var offline = new OfflineDevice(DeviceId, "COM3", null, ConnectionType.Serial, "1.0.0", HardwareVariant.TeensyRom, true, "Kitchen");
        _deviceManager.RenameAsync(DeviceId, "Kitchen", Arg.Any<CancellationToken>())
            .Returns(new RenameOutcome(RenameResult.Renamed, null, offline));
        var endpoint = EndpointFactory.CreateEndpoint<RenameDeviceEndpoint>(_deviceManager, _settingsProvider);

        await endpoint.Handle(GivenRequest(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response!.Device.IsConnected.Should().BeFalse();
        endpoint.Response.Device.Name.Should().Be("Kitchen");
    }

    [Fact]
    public async Task Handle_InvalidName_SendsBadRequest()
    {
        _deviceManager.RenameAsync(DeviceId, Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new RenameOutcome(RenameResult.InvalidName, null, null));
        var endpoint = EndpointFactory.CreateEndpoint<RenameDeviceEndpoint>(_deviceManager, _settingsProvider);

        await endpoint.Handle(GivenRequest("  "), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Handle_UnknownDevice_SendsNotFound()
    {
        _deviceManager.RenameAsync(DeviceId, "Kitchen", Arg.Any<CancellationToken>())
            .Returns(new RenameOutcome(RenameResult.UnknownDevice, null, null));
        var endpoint = EndpointFactory.CreateEndpoint<RenameDeviceEndpoint>(_deviceManager, _settingsProvider);

        await endpoint.Handle(GivenRequest(), CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData("Kitchen", true)]
    [InlineData("  ", false)]
    [InlineData("123456789012345678901234", true)]
    [InlineData("1234567890123456789012345", false)]
    public void Validator_AppliesTheSharedNameRule(string name, bool expectedValid)
    {
        var result = new RenameDeviceRequestValidator().Validate(GivenRequest(name));

        result.IsValid.Should().Be(expectedValid);
    }
}
