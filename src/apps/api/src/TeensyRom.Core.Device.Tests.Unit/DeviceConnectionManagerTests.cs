using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Usb;

namespace TeensyRom.Core.Device.Tests.Unit;

/// <summary>
/// Unit tests for the manager's three discovery occasions: records-only listing for a page load,
/// cache-first confirm at API start, and full discovery with resets. <see cref="ICartFinder"/>,
/// <see cref="IConnectionRecordCache"/>, ports, and the port locator are all faked so no occasion here
/// touches hardware.
/// </summary>
public class DeviceConnectionManagerTests
{
    private readonly ICartFinder _finder = Substitute.For<ICartFinder>();
    private readonly IConnectionRecordCache _cache = Substitute.For<IConnectionRecordCache>();
    private readonly IDeviceTransportFactory _transports = Substitute.For<IDeviceTransportFactory>();
    private readonly IDeviceInterrogator _interrogator = Substitute.For<IDeviceInterrogator>();
    private readonly ITeensyPortLocator _locator = Substitute.For<ITeensyPortLocator>();
    private readonly ConnectionOptions _options = new() { ConnectTimeoutMs = 5 };
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();

    private DeviceConnectionManager CreateManager() =>
        new(_finder, _cache, _transports, _interrogator, _locator, _options, _log);

    private static ICommunicationPort CreatePort(ConnectionType connectionType)
    {
        var port = Substitute.For<ICommunicationPort>();
        port.GetConnectionType().Returns(connectionType);
        return port;
    }

    private static TeensyRomDevice CreateDevice(string chipId, ConnectionType connectionType, string endpoint, ICommunicationPort port, DeviceMode mode = DeviceMode.FullIdle)
    {
        var cart = new Cart { DeviceId = chipId, IsCompatible = true };
        var device = new TeensyRomDevice(cart, port, Substitute.For<IStorageService>(), Substitute.For<IStorageService>(), new DeviceConnectionRecord(chipId));
        device.Confirm(connectionType, endpoint, mode);
        return device;
    }

    private void AllowSerialLookup(string chipId, string portName) =>
        _locator.FindByChipId(chipId).Returns(new PortLookup([new TeensyRomPort(portName, chipId, TeensyRomImage.Full)], true, null));

    [Fact]
    public async Task FindDevices_WithFullScanFalse_ReturnsCurrentDevicesWithoutInvokingFinderOrTouchingPorts()
    {
        var port = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("11112222", ConnectionType.Serial, "COM5", port);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("11112222", "COM5", null, ConnectionType.Serial) });
        AllowSerialLookup("11112222", "COM5");
        _transports.CreateSerial("COM5").Returns(port);
        _interrogator.ReadVersion(port).Returns(new VersionReply { IsTeensyRom = true, ChipId = "11112222" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);
        _finder.FindDevices(Arg.Any<CancellationToken>()).Returns(Task.FromException<List<TeensyRomDevice>>(new InvalidOperationException("full discovery must not run")));

        var manager = CreateManager();
        var started = await manager.ConnectAtStartAsync(CancellationToken.None);
        started.Should().ContainSingle();

        port.ClearReceivedCalls();
        _cache.ClearReceivedCalls();

        var listed = await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: false);

        listed.Should().Equal(started);
        await _finder.DidNotReceive().FindDevices(Arg.Any<CancellationToken>());
        port.DidNotReceive().OpenPort(Arg.Any<int>());
        port.DidNotReceive().OpenPort(Arg.Any<bool>());
        port.DidNotReceive().ClosePort();
        port.DidNotReceive().Write(Arg.Any<string>());
        port.DidNotReceive().Dispose();
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithTwoConfirmedSingleEndpointRows_SkipsFullDiscoveryAndRewritesTheSameRows()
    {
        var serialPort = CreatePort(ConnectionType.Serial);
        var tcpPort = CreatePort(ConnectionType.Tcp);
        var serialDevice = CreateDevice("11111111", ConnectionType.Serial, "COM3", serialPort);
        var tcpDevice = CreateDevice("22222222", ConnectionType.Tcp, "10.0.0.5:80", tcpPort);

        _cache.Load().Returns(new List<CachedConnectionRecord>
        {
            new("11111111", "COM3", null, ConnectionType.Serial),
            new("22222222", null, "10.0.0.5:80", ConnectionType.Tcp)
        });
        AllowSerialLookup("11111111", "COM3");
        _transports.CreateSerial("COM3").Returns(serialPort);
        _transports.CreateTcp("10.0.0.5:80").Returns(tcpPort);
        _interrogator.ReadVersion(serialPort).Returns(new VersionReply { IsTeensyRom = true, ChipId = "11111111" });
        _interrogator.ReadVersion(tcpPort).Returns(new VersionReply { IsTeensyRom = true, ChipId = "22222222" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(ci =>
        {
            var endpoint = ci.Arg<DiscoveredEndpoint>();
            return endpoint.Version.ChipId switch
            {
                "11111111" => serialDevice,
                "22222222" => tcpDevice,
                _ => null
            };
        });
        _finder.FindDevices(Arg.Any<CancellationToken>()).Returns(Task.FromException<List<TeensyRomDevice>>(new InvalidOperationException("full discovery must not run")));

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().Contain(serialDevice).And.Contain(tcpDevice).And.HaveCount(2);
        await _finder.Received(1).BuildDevice(
            Arg.Is<DiscoveredEndpoint>(e => e.ConnectionType == ConnectionType.Serial && e.Address == "COM3" && e.Version.ChipId == "11111111"),
            Arg.Any<CancellationToken>());
        await _finder.Received(1).BuildDevice(
            Arg.Is<DiscoveredEndpoint>(e => e.ConnectionType == ConnectionType.Tcp && e.Version.ChipId == "22222222"),
            Arg.Any<CancellationToken>());

        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows =>
            rows.Count() == 2 &&
            rows.Any(r => r.ChipId == "11111111" && r.SerialPortName == "COM3" && r.TcpEndpoint == null && r.TransportInUse == ConnectionType.Serial) &&
            rows.Any(r => r.ChipId == "22222222" && r.TcpEndpoint == "10.0.0.5:80" && r.SerialPortName == null && r.TransportInUse == ConnectionType.Tcp)));
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithRowHoldingBothEndpoints_NarrowsTheRewrittenRowToTheConfirmedTransport()
    {
        var port = CreatePort(ConnectionType.Tcp);
        var device = CreateDevice("33333333", ConnectionType.Tcp, "10.0.0.9:80", port);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("33333333", "COM7", "10.0.0.9:80", ConnectionType.Tcp) });
        _transports.CreateTcp("10.0.0.9:80").Returns(port);
        _interrogator.ReadVersion(port).Returns(new VersionReply { IsTeensyRom = true, ChipId = "33333333" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);

        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);

        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows =>
            rows.Single().SerialPortName == null && rows.Single().TcpEndpoint == "10.0.0.9:80"));
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithNoCache_RunsFullDiscoveryOnce()
    {
        var port = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("44444444", ConnectionType.Serial, "COM9", port);

        _cache.Load().Returns((IReadOnlyList<CachedConnectionRecord>?)null);
        _finder.FindDevices(Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { device });

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "44444444");
        await _finder.Received(1).FindDevices(Arg.Any<CancellationToken>());
        _cache.Received(1).Save(Arg.Any<IEnumerable<CachedConnectionRecord>>());
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithRowAnsweringWrongChip_RunsFullDiscoveryOnceAndCacheHoldsItsResult()
    {
        var cachedPort = CreatePort(ConnectionType.Serial);
        var freshPort = CreatePort(ConnectionType.Serial);
        var freshDevice = CreateDevice("55555555", ConnectionType.Serial, "COM10", freshPort);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("44444444", "COM9", null, ConnectionType.Serial) });
        AllowSerialLookup("44444444", "COM9");
        _transports.CreateSerial("COM9").Returns(cachedPort);
        _interrogator.ReadVersion(cachedPort).Returns(new VersionReply { IsTeensyRom = true, ChipId = "99999999" });
        _finder.FindDevices(Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { freshDevice });

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "55555555");
        await _finder.Received(1).FindDevices(Arg.Any<CancellationToken>());
        await _finder.DidNotReceive().BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>());
        cachedPort.Received(1).Dispose();
        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows => rows.Single().ChipId == "55555555"));
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithTcpRowThatTimesOutOpening_TreatsItAsAMissAndFallsBackToFullDiscovery()
    {
        var timingOutPort = CreatePort(ConnectionType.Tcp);
        timingOutPort.OpenPort(Arg.Any<int>()).Returns(_ => throw new TimeoutException("bounded connect timed out"));

        var freshPort = CreatePort(ConnectionType.Serial);
        var freshDevice = CreateDevice("66666666", ConnectionType.Serial, "COM11", freshPort);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("77777777", null, "10.0.0.20:80", ConnectionType.Tcp) });
        _transports.CreateTcp("10.0.0.20:80").Returns(timingOutPort);
        _finder.FindDevices(Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { freshDevice });

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "66666666");
        await _finder.Received(1).FindDevices(Arg.Any<CancellationToken>());
        _interrogator.DidNotReceive().ReadVersion(timingOutPort);
        timingOutPort.Received(1).Dispose();
    }

    [Fact]
    public async Task FindDevices_FullScan_WhenAChipIsAbsentFromTheNewSweep_MarksItUnreachableAndExcludesItFromCacheAndAvailability()
    {
        var port = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("88888888", ConnectionType.Serial, "COM12", port);

        _finder.FindDevices(Arg.Any<CancellationToken>()).Returns(
            new List<TeensyRomDevice> { device },
            new List<TeensyRomDevice>());

        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        manager.GetAvailableDevice("88888888").Should().NotBeNull();

        _cache.ClearReceivedCalls();
        var second = await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        second.Should().BeEmpty();
        manager.GetAvailableDevices().Should().BeEmpty();
        manager.GetAvailableDevice("88888888").Should().BeNull();
        device.Connection.Mode.Should().Be(DeviceMode.Unreachable);
        device.Connection.SerialPortName.Should().Be("COM12");
        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows => !rows.Any()));
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithCachedPortNameAmongSeveralCandidates_AcceptsTheCachedPortWithoutFullSweep()
    {
        var port = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("11112222", ConnectionType.Serial, "COM5", port);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("11112222", "COM5", null, ConnectionType.Serial) });
        _locator.FindByChipId("11112222").Returns(new PortLookup(
            [new TeensyRomPort("COM9", "11112222", TeensyRomImage.Minimal), new TeensyRomPort("COM5", "11112222", TeensyRomImage.Full)],
            true, null));
        _transports.CreateSerial("COM5").Returns(port);
        _interrogator.ReadVersion(port).Returns(new VersionReply { IsTeensyRom = true, ChipId = "11112222" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);
        _finder.FindDevices(Arg.Any<CancellationToken>()).Returns(Task.FromException<List<TeensyRomDevice>>(new InvalidOperationException("full discovery must not run")));

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "11112222");
        await _finder.Received(1).BuildDevice(Arg.Is<DiscoveredEndpoint>(e => e.Address == "COM5"), Arg.Any<CancellationToken>());
        _transports.DidNotReceive().CreateSerial("COM9");
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithCachedPortNoLongerACandidate_TriesRemainingCandidatesAndAdoptsTheFirstThatAnswers()
    {
        var firstCandidatePort = CreatePort(ConnectionType.Serial);
        firstCandidatePort.OpenPort(Arg.Any<int>()).Returns(_ => throw new TimeoutException("bounded connect timed out"));
        var secondCandidatePort = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("11112222", ConnectionType.Serial, "COM7", secondCandidatePort);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("11112222", "COM5", null, ConnectionType.Serial) });
        _locator.FindByChipId("11112222").Returns(new PortLookup(
            [new TeensyRomPort("COM9", "11112222", TeensyRomImage.Minimal), new TeensyRomPort("COM7", "11112222", TeensyRomImage.Full)],
            true, null));
        _transports.CreateSerial("COM9").Returns(firstCandidatePort);
        _transports.CreateSerial("COM7").Returns(secondCandidatePort);
        _interrogator.ReadVersion(secondCandidatePort).Returns(new VersionReply { IsTeensyRom = true, ChipId = "11112222" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);
        _finder.FindDevices(Arg.Any<CancellationToken>()).Returns(Task.FromException<List<TeensyRomDevice>>(new InvalidOperationException("full discovery must not run")));

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "11112222");
        await _finder.Received(1).BuildDevice(Arg.Is<DiscoveredEndpoint>(e => e.Address == "COM7"), Arg.Any<CancellationToken>());
        firstCandidatePort.Received(1).Dispose();
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithFilterUnavailable_TrustsTheCachedPortNameAndProceeds()
    {
        var port = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("11112222", ConnectionType.Serial, "COM5", port);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("11112222", "COM5", null, ConnectionType.Serial) });
        _locator.FindByChipId("11112222").Returns(new PortLookup([], false, "no USB descriptor reader supports this platform"));
        _transports.CreateSerial("COM5").Returns(port);
        _interrogator.ReadVersion(port).Returns(new VersionReply { IsTeensyRom = true, ChipId = "11112222" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);
        _finder.FindDevices(Arg.Any<CancellationToken>()).Returns(Task.FromException<List<TeensyRomDevice>>(new InvalidOperationException("full discovery must not run")));

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "11112222");
        await _finder.Received(1).BuildDevice(Arg.Is<DiscoveredEndpoint>(e => e.Address == "COM5"), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task FindDevices_FullScan_TwoConcurrentCalls_InvokeTheFinderOnce()
    {
        var completion = new TaskCompletionSource<List<TeensyRomDevice>>();
        _finder.FindDevices(Arg.Any<CancellationToken>()).Returns(completion.Task);

        var manager = CreateManager();

        var first = manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        var second = manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        completion.SetResult([]);
        await Task.WhenAll(first, second);

        await _finder.Received(1).FindDevices(Arg.Any<CancellationToken>());
    }
}
