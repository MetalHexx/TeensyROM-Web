using NSubstitute;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Services;
using static TeensyRom.Cli.Tests.ApiTestSupport;

namespace TeensyRom.Cli.Tests;

public class DeviceServiceTests
{
    private readonly ITeensyRomApiClient _api = Substitute.For<ITeensyRomApiClient>();
    private readonly DeviceService _sut;

    public DeviceServiceTests() => _sut = new DeviceService(_api);

    private void ApiKnowsDevices(params CartDto[] carts) =>
        _api.FindDevicesAsync(false, Arg.Any<CancellationToken>()).Returns(new FindDevicesResponse { Devices = carts });

    private void ApiFailsListingDevices(Exception failure) =>
        _api.FindDevicesAsync(false, Arg.Any<CancellationToken>()).Returns(Task.FromException<FindDevicesResponse>(failure));

    private static CartDto Cart(string id, string name, DeviceState state, ConnectionType connection = ConnectionType.Serial) => new()
    {
        DeviceId = id,
        Name = name,
        DeviceState = state,
        ConnectionType = connection,
        ComPort = "COM3",
        IpAddress = "10.0.0.7"
    };

    [Fact]
    public async Task GetDevices_ListsOnlineAndOfflineUnitsWithTheirConnection()
    {
        ApiKnowsDevices(
            Cart("a", "Alpha", DeviceState.Connected),
            Cart("b", "Bravo", DeviceState.Connectable, ConnectionType.Tcp),
            Cart("c", "Charlie", DeviceState.ConnectionLost));

        var devices = await _sut.GetDevicesAsync();

        devices.Should().BeEquivalentTo(new[]
        {
            new DeviceSummary("a", "Alpha", true, "USB COM3", "Connected"),
            new DeviceSummary("b", "Bravo", true, "Ethernet 10.0.0.7", "Connectable"),
            new DeviceSummary("c", "Charlie", false, "USB COM3", "ConnectionLost")
        }, options => options.WithStrictOrdering());
    }

    [Fact]
    public async Task GetDevices_WhenTrWebKnowsNone_IsEmpty()
    {
        ApiFailsListingDevices(ApiFailure(404, "\"No devices found.\""));

        var devices = await _sut.GetDevicesAsync();

        devices.Should().BeEmpty();
    }

    [Fact]
    public async Task GetDevices_WhenRateLimited_SaysTrWebIsBusy()
    {
        ApiFailsListingDevices(ApiFailure(503, ""));

        var act = () => _sut.GetDevicesAsync();

        var failure = (await act.Should().ThrowAsync<TeensyApiException>()).Which;
        failure.Message.Should().Be("tr-web is busy listing devices — try again in a few seconds.");
        failure.StatusCode.Should().Be(503);
    }

    [Fact]
    public async Task GetDevices_WhenTrWebIsGone_SaysItStoppedAnswering()
    {
        ApiFailsListingDevices(new HttpRequestException("refused"));

        var act = () => _sut.GetDevicesAsync();

        var failure = (await act.Should().ThrowAsync<TeensyApiException>()).Which;
        failure.Message.Should().Contain("tr-web stopped answering");
        failure.StatusCode.Should().BeNull();
    }

    [Fact]
    public async Task GetDevices_NeverAsksForAFullScan()
    {
        ApiKnowsDevices();

        await _sut.GetDevicesAsync();

        await _api.Received(1).FindDevicesAsync(false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Find_WithAFullScan_AsksTheApiToScan_WhileGetDevicesNeverDoes()
    {
        _api.FindDevicesAsync(true, Arg.Any<CancellationToken>()).Returns(new FindDevicesResponse { Devices = [Cart("a", "Alpha", DeviceState.Connected)] });

        var found = await _sut.FindAsync(fullScan: true);

        found.Should().ContainSingle().Which.Name.Should().Be("Alpha");
        await _api.Received(1).FindDevicesAsync(true, Arg.Any<CancellationToken>());
        await _api.DidNotReceive().FindDevicesAsync(false, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Find_WhenTrWebKnowsNone_IsEmptyEvenAfterAScan(bool fullScan)
    {
        _api.FindDevicesAsync(fullScan, Arg.Any<CancellationToken>())
            .Returns(Task.FromException<FindDevicesResponse>(ApiFailure(404, "\"No TeensyRom devices found.\"")));

        var found = await _sut.FindAsync(fullScan);

        found.Should().BeEmpty();
    }

    [Fact]
    public async Task Find_ReportsWhichStoragesAreAvailable()
    {
        var cart = Cart("a", "Alpha", DeviceState.Connected);
        cart.SdStorage = new CartStorageDto { Available = true };
        cart.UsbStorage = new CartStorageDto { Available = false };
        ApiKnowsDevices(cart);

        var found = await _sut.FindAsync(fullScan: false);

        found.Should().ContainSingle().Which.Should().Match<DeviceSummary>(d => d.SdAvailable && !d.UsbAvailable);
    }
    [Fact]
    public async Task ReconnectDevice_ReturnsTheDeviceAfterwards()
    {
        _api.ReconnectDeviceAsync("a", Arg.Any<CancellationToken>())
            .Returns(new ReconnectDeviceResponse { Device = Cart("a", "Alpha", DeviceState.Connected), Message = "Reconnected." });

        var device = await _sut.ReconnectDeviceAsync("a");

        device.Should().Be(new DeviceSummary("a", "Alpha", true, "USB COM3", "Connected"));
    }

    [Fact]
    public async Task RenameDevice_SendsTheNewName_AndReturnsTheRenamedDevice()
    {
        _api.RenameDeviceAsync("a", Arg.Is<RenameDeviceBody>(body => body.Name == "Bench"), Arg.Any<CancellationToken>())
            .Returns(new RenameDeviceResponse { Device = Cart("a", "Bench", DeviceState.Connected), Message = "Renamed." });

        var device = await _sut.RenameDeviceAsync("a", "Bench");

        device.Name.Should().Be("Bench");
    }

    [Fact]
    public async Task ForgetPingAndReset_ReturnTrWebsMessage()
    {
        _api.ForgetDeviceAsync("a", Arg.Any<CancellationToken>()).Returns(new ForgetDeviceResponse { Message = "Forgotten." });
        _api.PingDeviceAsync("a", Arg.Any<CancellationToken>()).Returns(new PingDeviceResponse { Message = "Pong." });
        _api.ResetDeviceAsync("a", Arg.Any<CancellationToken>()).Returns(new ResetDeviceResponse { Message = "Reset." });

        (await _sut.ForgetDeviceAsync("a")).Should().Be("Forgotten.");
        (await _sut.PingDeviceAsync("a")).Should().Be("Pong.");
        (await _sut.ResetDeviceAsync("a")).Should().Be("Reset.");
    }

    [Fact]
    public async Task ForgetDevice_WhenTrWebDoesNotKnowIt_ThrowsWithTheStatus()
    {
        _api.ForgetDeviceAsync("nope", Arg.Any<CancellationToken>()).Returns(Task.FromException<ForgetDeviceResponse>(ApiFailure(404, "\"Device not found.\"")));

        var act = () => _sut.ForgetDeviceAsync("nope");

        (await act.Should().ThrowAsync<TeensyApiException>()).Which.StatusCode.Should().Be(404);
    }

    [Fact]
    public void RequireDeviceId_WithoutASelection_Throws()
    {
        var act = () => _sut.RequireDeviceId();

        act.Should().Throw<TeensyApiException>().WithMessage("No TeensyROM is selected.");
    }

    [Fact]
    public void RequireDeviceId_AfterSelect_ReturnsTheSelectedId()
    {
        var device = new DeviceSummary("abc123", "Alpha", true, "USB COM3", "Connected");

        _sut.Select(device);

        _sut.SelectedDevice.Should().Be(device);
        _sut.RequireDeviceId().Should().Be("abc123");
    }
}
