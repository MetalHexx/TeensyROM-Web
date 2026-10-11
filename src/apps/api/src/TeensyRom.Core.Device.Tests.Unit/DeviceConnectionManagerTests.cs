using TeensyRom.Core.Common;
using TeensyRom.Core.Entities.Serial;
using TeensyRom.Core.Serial.Recovery;
using TeensyRom.Core.Serial.Usb;

namespace TeensyRom.Core.Device.Tests.Unit;

/// <summary>
/// Unit tests for the manager's occasions: records-only listing for a page load, cache-first confirm at
/// API start (never aborting into a full discovery), full discovery with resets, the one search for
/// missing units that both the start and Reconnect share, and the explicit Reconnect/Forget pair.
/// <see cref="ICartFinder"/>, <see cref="IConnectionRecordCache"/>, ports, and the port locator are all
/// faked so no occasion here touches hardware.
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

    /// <summary>Guards a scenario that must never fall back to a full/parameterless-skip-set discovery.</summary>
    private void ForbidDiscovery() =>
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<List<TeensyRomDevice>>(new InvalidOperationException("discovery must not run")));

    [Fact]
    public async Task FindDevices_WithFullScanFalse_ReturnsCurrentDevicesWithoutInvokingFinderOrTouchingPorts()
    {
        var port = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("11112222", ConnectionType.Serial, "COM5", port);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("11112222", "COM5", null, ConnectionType.Serial) });
        AllowSerialLookup("11112222", "COM5");
        _transports.CreateSerial("COM5", true).Returns(port);
        _interrogator.ReadVersion(port).Returns(new VersionReply { IsTeensyRom = true, ChipId = "11112222" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);
        ForbidDiscovery();

        var manager = CreateManager();
        var started = await manager.ConnectAtStartAsync(CancellationToken.None);
        started.Should().ContainSingle();
        _transports.Received(1).CreateSerial("COM5", true);

        port.ClearReceivedCalls();
        _cache.ClearReceivedCalls();

        var listed = await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: false);

        listed.Should().Equal(started);
        await _finder.DidNotReceive().FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>());
        port.DidNotReceive().OpenPort(Arg.Any<int>());
        port.DidNotReceive().OpenPort(Arg.Any<bool>());
        port.DidNotReceive().ClosePort();
        port.DidNotReceive().Write(Arg.Any<string>());
        port.DidNotReceive().Dispose();
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithTwoConfirmedSingleEndpointRows_SkipsDiscoveryAndSavesRowsWithFacts()
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
        _transports.CreateSerial("COM3", true).Returns(serialPort);
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
        ForbidDiscovery();

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().Contain(serialDevice).And.Contain(tcpDevice).And.HaveCount(2);
        await _finder.Received(1).BuildDevice(
            Arg.Is<DiscoveredEndpoint>(e => e.ConnectionType == ConnectionType.Serial && e.Address == "COM3" && e.Version.ChipId == "11111111"),
            Arg.Any<CancellationToken>());
        await _finder.Received(1).BuildDevice(
            Arg.Is<DiscoveredEndpoint>(e => e.ConnectionType == ConnectionType.Tcp && e.Version.ChipId == "22222222"),
            Arg.Any<CancellationToken>());
        _transports.Received(1).CreateSerial("COM3", true);

        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows =>
            rows.Count() == 2 &&
            rows.Any(r => r.ChipId == "11111111" && r.SerialPortName == "COM3" && r.TcpEndpoint == null && r.TransportInUse == ConnectionType.Serial && !r.Offline && r.IsCompatible) &&
            rows.Any(r => r.ChipId == "22222222" && r.TcpEndpoint == "10.0.0.5:80" && r.SerialPortName == null && r.TransportInUse == ConnectionType.Tcp && !r.Offline && r.IsCompatible)));
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithRowHoldingBothEndpoints_KeepsTheOtherEndpointOnTheRewrittenRow()
    {
        var port = CreatePort(ConnectionType.Tcp);
        var device = CreateDevice("33333333", ConnectionType.Tcp, "10.0.0.9:80", port);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("33333333", "COM7", "10.0.0.9:80", ConnectionType.Tcp) });
        _transports.CreateTcp("10.0.0.9:80").Returns(port);
        _interrogator.ReadVersion(port).Returns(new VersionReply { IsTeensyRom = true, ChipId = "33333333" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);

        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);

        device.Connection.SerialPortName.Should().Be("COM7");
        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows =>
            rows.Single().SerialPortName == "COM7" && rows.Single().TcpEndpoint == "10.0.0.9:80"));
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithNoCache_RunsFullDiscoveryOnce()
    {
        var port = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("44444444", ConnectionType.Serial, "COM9", port);

        _cache.Load().Returns((IReadOnlyList<CachedConnectionRecord>?)null);
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { device });

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "44444444");
        await _finder.Received(1).FindDevices(Arg.Is<IReadOnlySet<string>>(s => s.Count == 0), Arg.Any<CancellationToken>());
        _cache.Received(1).Save(Arg.Any<IEnumerable<CachedConnectionRecord>>());
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithRowAnsweringWrongChip_RunsOneSearchAndCacheHoldsTheMissedRowFlaggedOffline()
    {
        var cachedPort = CreatePort(ConnectionType.Serial);
        var freshPort = CreatePort(ConnectionType.Serial);
        var freshDevice = CreateDevice("55555555", ConnectionType.Serial, "COM10", freshPort);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("44444444", "COM9", null, ConnectionType.Serial) });
        AllowSerialLookup("44444444", "COM9");
        _transports.CreateSerial("COM9", true).Returns(cachedPort);
        _interrogator.ReadVersion(cachedPort).Returns(new VersionReply { IsTeensyRom = true, ChipId = "99999999" });
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { freshDevice });

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "55555555");
        await _finder.Received(1).FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>());
        await _finder.DidNotReceive().BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>());
        cachedPort.Received(1).Dispose();
        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows =>
            rows.Any(r => r.ChipId == "55555555" && !r.Offline) &&
            rows.Any(r => r.ChipId == "44444444" && r.Offline)));
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithTcpRowThatTimesOutOpening_TreatsItAsAMissAndFallsBackToOneSearch()
    {
        var timingOutPort = CreatePort(ConnectionType.Tcp);
        timingOutPort.OpenPort(Arg.Any<int>()).Returns(_ => throw new TimeoutException("bounded connect timed out"));

        var freshPort = CreatePort(ConnectionType.Serial);
        var freshDevice = CreateDevice("66666666", ConnectionType.Serial, "COM11", freshPort);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("77777777", null, "10.0.0.20:80", ConnectionType.Tcp) });
        _transports.CreateTcp("10.0.0.20:80").Returns(timingOutPort);
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { freshDevice });

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "66666666");
        await _finder.Received(1).FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>());
        _interrogator.DidNotReceive().ReadVersion(timingOutPort);
        timingOutPort.Received(1).Dispose();
    }

    [Fact]
    public async Task FindDevices_FullScan_WhenAChipIsAbsentFromTheNewSweep_MarksItUnreachableAndKeepsItSavedFlaggedOffline()
    {
        var port = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("88888888", ConnectionType.Serial, "COM12", port);
        var otherPort = CreatePort(ConnectionType.Serial);
        var otherDevice = CreateDevice("99999999", ConnectionType.Serial, "COM13", otherPort);

        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(
            new List<TeensyRomDevice> { device },
            new List<TeensyRomDevice>(),
            new List<TeensyRomDevice> { otherDevice });

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
        // An empty sweep still saves - every known unit, now flagged offline - unlike P08-T01's rule.
        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows =>
            rows.Count() == 1 && rows.Single().ChipId == "88888888" && rows.Single().Offline));

        // A later sweep that finds a different device still saves every known unit, the absent one flagged.
        var third = await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        third.Should().ContainSingle(d => d.DeviceId == "99999999");
        manager.GetAvailableDevice("88888888").Should().BeNull();
        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows =>
            rows.Count() == 2 &&
            rows.Any(r => r.ChipId == "99999999" && !r.Offline) &&
            rows.Any(r => r.ChipId == "88888888" && r.Offline)));
    }

    [Fact]
    public async Task FindDevices_FullScan_WhenAKnownDeviceIsRediscoveredOnTheOtherTransport_CarriesForwardTheOldEndpoint()
    {
        var tcpPort = CreatePort(ConnectionType.Tcp);
        var tcpDevice = CreateDevice("12345678", ConnectionType.Tcp, "10.0.0.9:80", tcpPort);
        var serialPort = CreatePort(ConnectionType.Serial);
        var serialDevice = CreateDevice("12345678", ConnectionType.Serial, "COM4", serialPort);

        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(
            new List<TeensyRomDevice> { tcpDevice },
            new List<TeensyRomDevice> { serialDevice });

        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        _cache.ClearReceivedCalls();
        var second = await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        second.Should().ContainSingle(d => d.DeviceId == "12345678");
        serialDevice.Connection.SerialPortName.Should().Be("COM4");
        serialDevice.Connection.TcpEndpoint.Should().Be("10.0.0.9:80");
        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows =>
            rows.Single().SerialPortName == "COM4" && rows.Single().TcpEndpoint == "10.0.0.9:80"));
    }

    [Fact]
    public async Task FindDevices_FullScan_WhenAKnownDeviceMovesOnTheSameTransport_TheNewEndpointReplacesTheOld()
    {
        var firstPort = CreatePort(ConnectionType.Serial);
        var firstDevice = CreateDevice("aabbccdd", ConnectionType.Serial, "COM3", firstPort);
        var secondPort = CreatePort(ConnectionType.Serial);
        var secondDevice = CreateDevice("aabbccdd", ConnectionType.Serial, "COM9", secondPort);

        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(
            new List<TeensyRomDevice> { firstDevice },
            new List<TeensyRomDevice> { secondDevice });

        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        var second = await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        second.Should().ContainSingle(d => d.DeviceId == "aabbccdd");
        secondDevice.Connection.SerialPortName.Should().Be("COM9");
    }

    [Fact]
    public async Task FindDevices_FullScan_WhenTwoDevicesAreConfirmedAtTheSameEndpoint_TheLaterOneKeepsIt()
    {
        var portA = CreatePort(ConnectionType.Tcp);
        var deviceA = CreateDevice("aaaaaaaa", ConnectionType.Tcp, "10.0.0.9:80", portA);
        var portB = CreatePort(ConnectionType.Tcp);
        var deviceB = CreateDevice("bbbbbbbb", ConnectionType.Tcp, "10.0.0.9:80", portB);

        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { deviceA, deviceB });

        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        deviceA.Connection.TcpEndpoint.Should().BeNull();
        deviceB.Connection.TcpEndpoint.Should().Be("10.0.0.9:80");
    }

    [Fact]
    public async Task FindDevices_FullScan_PassesAnEmptySkipSet()
    {
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice>());

        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        await _finder.Received(1).FindDevices(Arg.Is<IReadOnlySet<string>>(s => s.Count == 0), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithCachedTransportMissing_ConfirmsOnTheOtherEndpointWithoutASearch()
    {
        _options.PreferredTransport = ConnectionType.Serial;
        var serialPort = CreatePort(ConnectionType.Serial);
        serialPort.OpenPort(Arg.Any<int>()).Returns(_ => throw new TimeoutException("bounded connect timed out"));
        var tcpPort = CreatePort(ConnectionType.Tcp);
        var device = CreateDevice("44445555", ConnectionType.Tcp, "10.0.0.30:80", tcpPort);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("44445555", "COM20", "10.0.0.30:80", ConnectionType.Serial) });
        AllowSerialLookup("44445555", "COM20");
        _transports.CreateSerial("COM20", true).Returns(serialPort);
        _transports.CreateTcp("10.0.0.30:80").Returns(tcpPort);
        _interrogator.ReadVersion(tcpPort).Returns(new VersionReply { IsTeensyRom = true, ChipId = "44445555" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);
        ForbidDiscovery();

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "44445555");
        await _finder.DidNotReceive().FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>());
        device.Connection.SerialPortName.Should().Be("COM20");
        device.Connection.TcpEndpoint.Should().Be("10.0.0.30:80");
        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows =>
            rows.Single().SerialPortName == "COM20" && rows.Single().TcpEndpoint == "10.0.0.30:80"));
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithCachedPortNameAmongSeveralCandidates_AcceptsTheCachedPortWithoutASearch()
    {
        var port = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("11112222", ConnectionType.Serial, "COM5", port);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("11112222", "COM5", null, ConnectionType.Serial) });
        _locator.FindByChipId("11112222").Returns(new PortLookup(
            [new TeensyRomPort("COM9", "11112222", TeensyRomImage.Minimal), new TeensyRomPort("COM5", "11112222", TeensyRomImage.Full)],
            true, null));
        _transports.CreateSerial("COM5", true).Returns(port);
        _interrogator.ReadVersion(port).Returns(new VersionReply { IsTeensyRom = true, ChipId = "11112222" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);
        ForbidDiscovery();

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "11112222");
        await _finder.Received(1).BuildDevice(Arg.Is<DiscoveredEndpoint>(e => e.Address == "COM5"), Arg.Any<CancellationToken>());
        _transports.Received(1).CreateSerial("COM5", true);
        _transports.DidNotReceive().CreateSerial("COM9", Arg.Any<bool>());
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
        _transports.CreateSerial("COM9", true).Returns(firstCandidatePort);
        _transports.CreateSerial("COM7", true).Returns(secondCandidatePort);
        _interrogator.ReadVersion(secondCandidatePort).Returns(new VersionReply { IsTeensyRom = true, ChipId = "11112222" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);
        ForbidDiscovery();

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "11112222");
        await _finder.Received(1).BuildDevice(Arg.Is<DiscoveredEndpoint>(e => e.Address == "COM7"), Arg.Any<CancellationToken>());
        firstCandidatePort.Received(1).Dispose();
        _transports.Received(1).CreateSerial("COM9", true);
        _transports.Received(1).CreateSerial("COM7", true);
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithFilterUnavailable_TrustsTheCachedPortNameAndProceeds()
    {
        var port = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("11112222", ConnectionType.Serial, "COM5", port);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("11112222", "COM5", null, ConnectionType.Serial) });
        _locator.FindByChipId("11112222").Returns(new PortLookup([], false, "no USB descriptor reader supports this platform"));
        _transports.CreateSerial("COM5", false).Returns(port);
        _interrogator.ReadVersion(port).Returns(new VersionReply { IsTeensyRom = true, ChipId = "11112222" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);
        ForbidDiscovery();

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "11112222");
        await _finder.Received(1).BuildDevice(Arg.Is<DiscoveredEndpoint>(e => e.Address == "COM5"), Arg.Any<CancellationToken>());
        _transports.Received(1).CreateSerial("COM5", false);
    }

    /// <summary>An Unknown row (macOS: descriptor cannot prove vendor/product) never asserts DTR, even though it is a live candidate.</summary>
    [Fact]
    public async Task ConnectAtStartAsync_WithCachedPortNameMatchingAnUnknownCandidate_OpensItWithDtrOff()
    {
        var port = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("11112222", ConnectionType.Serial, "/dev/cu.usbmodem1", port);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("11112222", "/dev/cu.usbmodem1", null, ConnectionType.Serial) });
        _locator.FindByChipId("11112222").Returns(new PortLookup(
            [new TeensyRomPort("/dev/cu.usbmodem1", "11112222", TeensyRomImage.Unknown)],
            true, null));
        _transports.CreateSerial("/dev/cu.usbmodem1", false).Returns(port);
        _interrogator.ReadVersion(port).Returns(new VersionReply { IsTeensyRom = true, ChipId = "11112222" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);
        ForbidDiscovery();

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "11112222");
        _transports.Received(1).CreateSerial("/dev/cu.usbmodem1", false);
    }

    [Fact]
    public async Task FindDevices_FullScan_TwoConcurrentCalls_InvokeTheFinderOnce()
    {
        var completion = new TaskCompletionSource<List<TeensyRomDevice>>();
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(completion.Task);

        var manager = CreateManager();

        var first = manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        var second = manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        completion.SetResult([]);
        await Task.WhenAll(first, second);

        await _finder.Received(1).FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>());
    }

    // --- Start: miss handling, preference order, offline flag, resilience ---

    [Fact]
    public async Task ConnectAtStartAsync_WithCreateSerialThrowingForTheCachedPortName_IsAMissAndNeverThrows()
    {
        _cache.Load().Returns(new List<CachedConnectionRecord> { new("aaaa1111", "COM40", null, ConnectionType.Serial) });
        _locator.FindByChipId("aaaa1111").Returns(new PortLookup([], false, "no USB descriptor reader supports this platform"));
        _transports.CreateSerial("COM40", false).Returns(_ => throw new TeensyException("COM40 is not present"));
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice>());

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithPreferredTransportTcp_TriesTcpFirstAndNeverTouchesSerial()
    {
        _options.PreferredTransport = ConnectionType.Tcp;
        var tcpPort = CreatePort(ConnectionType.Tcp);
        var device = CreateDevice("abc12300", ConnectionType.Tcp, "10.0.0.7:80", tcpPort);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("abc12300", "COM6", "10.0.0.7:80", ConnectionType.Serial) });
        _transports.CreateTcp("10.0.0.7:80").Returns(tcpPort);
        _interrogator.ReadVersion(tcpPort).Returns(new VersionReply { IsTeensyRom = true, ChipId = "abc12300" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "abc12300");
        _transports.Received(1).CreateTcp("10.0.0.7:80");
        _transports.DidNotReceive().CreateSerial(Arg.Any<string>(), Arg.Any<bool>());
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithPreferredTransportSerial_TriesSerialFirstAndNeverTouchesTcp()
    {
        _options.PreferredTransport = ConnectionType.Serial;
        var serialPort = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("abc12300", ConnectionType.Serial, "COM6", serialPort);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("abc12300", "COM6", "10.0.0.7:80", ConnectionType.Tcp) });
        AllowSerialLookup("abc12300", "COM6");
        _transports.CreateSerial("COM6", true).Returns(serialPort);
        _interrogator.ReadVersion(serialPort).Returns(new VersionReply { IsTeensyRom = true, ChipId = "abc12300" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "abc12300");
        _transports.Received(1).CreateSerial("COM6", true);
        _transports.DidNotReceive().CreateTcp(Arg.Any<string>());
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithOneOnlineLastTimeRowMissing_RunsOneSearchSkippingConfirmedUnitsWithoutDisposingThem()
    {
        var confirmedPort = CreatePort(ConnectionType.Serial);
        var confirmedDevice = CreateDevice("confirme", ConnectionType.Serial, "COM3", confirmedPort);

        _cache.Load().Returns(new List<CachedConnectionRecord>
        {
            new("confirme", "COM3", null, ConnectionType.Serial),
            new("missingg", null, "10.0.0.9:80", ConnectionType.Tcp)
        });
        AllowSerialLookup("confirme", "COM3");
        _transports.CreateSerial("COM3", true).Returns(confirmedPort);
        _interrogator.ReadVersion(confirmedPort).Returns(new VersionReply { IsTeensyRom = true, ChipId = "confirme" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(confirmedDevice);
        // "missingg" row's TCP endpoint is left unstubbed on _transports: creating it returns null, a miss.
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice>());

        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);

        await _finder.Received(1).FindDevices(Arg.Is<IReadOnlySet<string>>(s => s.Contains("COM3")), Arg.Any<CancellationToken>());
        confirmedPort.DidNotReceive().Dispose();
        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows =>
            rows.Any(r => r.ChipId == "missingg" && r.Offline)));
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithOnlyAnOfflineRowMissing_RunsNoSearch()
    {
        _cache.Load().Returns(new List<CachedConnectionRecord> { new("offline1", null, "10.0.0.9:80", ConnectionType.Tcp, Offline: true) });
        // Endpoint left unstubbed: creating it returns null, a miss.

        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);

        await _finder.DidNotReceive().FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>());
        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows => rows.Single().ChipId == "offline1" && rows.Single().Offline));
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithAnOfflineRowThatAnswers_ClearsTheOfflineFlag()
    {
        var port = CreatePort(ConnectionType.Tcp);
        var device = CreateDevice("offline2", ConnectionType.Tcp, "10.0.0.9:80", port);

        _cache.Load().Returns(new List<CachedConnectionRecord> { new("offline2", null, "10.0.0.9:80", ConnectionType.Tcp, Offline: true) });
        _transports.CreateTcp("10.0.0.9:80").Returns(port);
        _interrogator.ReadVersion(port).Returns(new VersionReply { IsTeensyRom = true, ChipId = "offline2" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);

        var manager = CreateManager();
        var result = await manager.ConnectAtStartAsync(CancellationToken.None);

        result.Should().ContainSingle(d => d.DeviceId == "offline2");
        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows => rows.Single().ChipId == "offline2" && !rows.Single().Offline));
    }

    [Fact]
    public async Task ConnectAtStartAsync_WhenTheSearchThrows_StillLeavesTheRowKnownForTheNextDiscoverDevices()
    {
        _cache.Load().Returns(new List<CachedConnectionRecord> { new("stillknn", null, "10.0.0.9:80", ConnectionType.Tcp) });
        // The row's own endpoint is unstubbed (a miss), so the start runs a search.

        var callCount = 0;
        // Discovered fresh on a different transport (Serial) than the stale row's TCP endpoint, so a
        // carried-forward TCP endpoint on the result is proof the row survived the earlier failure.
        var freshPort = CreatePort(ConnectionType.Serial);
        var freshDevice = CreateDevice("stillknn", ConnectionType.Serial, "COM50", freshPort);
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(_ =>
        {
            callCount++;
            if (callCount == 1)
            {
                throw new InvalidOperationException("search failed");
            }
            return new List<TeensyRomDevice> { freshDevice };
        });

        var manager = CreateManager();
        var started = await manager.ConnectAtStartAsync(CancellationToken.None);

        started.Should().BeEmpty();

        var discovered = await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        discovered.Should().ContainSingle(d => d.DeviceId == "stillknn");
        freshDevice.Connection.SerialPortName.Should().Be("COM50");
        freshDevice.Connection.TcpEndpoint.Should().Be("10.0.0.9:80");
    }

    [Fact]
    public async Task ConnectAtStartAsync_ThroughTheSerialCandidateLoop_AdoptingAMovedPortReleasesItFromAnotherKnownChip()
    {
        var movedPort = CreatePort(ConnectionType.Serial);
        var movedDevice = CreateDevice("moved111", ConnectionType.Serial, "COM7", movedPort);

        _cache.Load().Returns(new List<CachedConnectionRecord>
        {
            new("moved111", "COM5", null, ConnectionType.Serial),
            new("otherppp", "COM7", null, ConnectionType.Serial)
        });
        _locator.FindByChipId("moved111").Returns(new PortLookup([new TeensyRomPort("COM7", "moved111", TeensyRomImage.Full)], true, null));
        _locator.FindByChipId("otherppp").Returns(new PortLookup([], true, null));
        _transports.CreateSerial("COM7", true).Returns(movedPort);
        _interrogator.ReadVersion(movedPort).Returns(new VersionReply { IsTeensyRom = true, ChipId = "moved111" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(movedDevice);
        // "otherppp" has no candidates (empty filter result) - it misses and stays known, offline.
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice>());

        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);

        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows =>
            rows.Any(r => r.ChipId == "moved111" && r.SerialPortName == "COM7") &&
            rows.Any(r => r.ChipId == "otherppp" && r.SerialPortName == null)));
    }

    // --- Reconnect ---

    [Fact]
    public async Task ReconnectAsync_WhenAlreadyAvailable_ReturnsAlreadyAvailableWithoutOpeningAPort()
    {
        var port = CreatePort(ConnectionType.Tcp);
        var device = CreateDevice("alreadyav", ConnectionType.Tcp, "10.0.0.9:80", port);
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { device });

        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        port.ClearReceivedCalls();

        var outcome = await manager.ReconnectAsync("alreadyav", CancellationToken.None);

        outcome.Result.Should().Be(ReconnectResult.AlreadyAvailable);
        outcome.Device.Should().Be(device);
        port.DidNotReceive().OpenPort(Arg.Any<int>());
    }

    [Fact]
    public async Task ReconnectAsync_WhenUnknown_ReturnsUnknownDevice()
    {
        var manager = CreateManager();
        var outcome = await manager.ReconnectAsync("nosuchchip", CancellationToken.None);

        outcome.Result.Should().Be(ReconnectResult.UnknownDevice);
        outcome.Device.Should().BeNull();
    }

    [Fact]
    public async Task ReconnectAsync_WhenTheSavedEndpointAnswers_ReconnectsWithoutCallingFindDevicesAndCarriesForwardTheOtherEndpoint()
    {
        var staleDevice = CreateDevice("reconnct", ConnectionType.Tcp, "10.0.0.9:80", CreatePort(ConnectionType.Tcp));
        staleDevice.Connection.RememberEndpoint(ConnectionType.Serial, "COM8");

        var finderStub = Substitute.For<ICartFinder>();
        var manager = new DeviceConnectionManager(finderStub, _cache, _transports, _interrogator, _locator, _options, _log);

        // Seed the manager's knowledge of this unreachable device via a full discovery that then loses it.
        finderStub.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(
            new List<TeensyRomDevice> { staleDevice },
            new List<TeensyRomDevice>());
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        var freshPort = CreatePort(ConnectionType.Tcp);
        var freshDevice = CreateDevice("reconnct", ConnectionType.Tcp, "10.0.0.9:80", freshPort);
        _transports.CreateTcp("10.0.0.9:80").Returns(freshPort);
        _interrogator.ReadVersion(freshPort).Returns(new VersionReply { IsTeensyRom = true, ChipId = "reconnct" });
        finderStub.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(freshDevice);

        var outcome = await manager.ReconnectAsync("reconnct", CancellationToken.None);

        outcome.Result.Should().Be(ReconnectResult.Reconnected);
        freshDevice.Connection.SerialPortName.Should().Be("COM8");
        await finderStub.DidNotReceive().FindDevices(Arg.Is<IReadOnlySet<string>>(s => s.Count > 0), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReconnectAsync_WhenTheSavedEndpointMissesButTheSearchFindsIt_ReturnsReconnectedAndSkipsConnectedUnits()
    {
        var connectedPort = CreatePort(ConnectionType.Serial);
        var connectedDevice = CreateDevice("connectd", ConnectionType.Serial, "COM3", connectedPort);

        _cache.Load().Returns(new List<CachedConnectionRecord>
        {
            new("connectd", "COM3", null, ConnectionType.Serial),
            new("missing2", null, "10.0.0.50:80", ConnectionType.Tcp, Offline: true)
        });
        AllowSerialLookup("connectd", "COM3");
        _transports.CreateSerial("COM3", true).Returns(connectedPort);
        _interrogator.ReadVersion(connectedPort).Returns(new VersionReply { IsTeensyRom = true, ChipId = "connectd" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(connectedDevice);
        // "missing2" is left unstubbed at start (a miss); since it's the only miss and it's offline, no search runs yet.

        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);

        var foundPort = CreatePort(ConnectionType.Tcp);
        var foundDevice = CreateDevice("missing2", ConnectionType.Tcp, "10.0.0.51:80", foundPort);
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { foundDevice });

        var outcome = await manager.ReconnectAsync("missing2", CancellationToken.None);

        outcome.Result.Should().Be(ReconnectResult.Reconnected);
        await _finder.Received(1).FindDevices(Arg.Is<IReadOnlySet<string>>(s => s.Contains("COM3")), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReconnectAsync_WhenTheSearchDoesNotFindIt_ReturnsNotFound()
    {
        _cache.Load().Returns(new List<CachedConnectionRecord> { new("notfound1", null, "10.0.0.9:80", ConnectionType.Tcp, Offline: true) });

        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);

        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice>());

        var outcome = await manager.ReconnectAsync("notfound1", CancellationToken.None);

        outcome.Result.Should().Be(ReconnectResult.NotFound);
        outcome.Device.Should().BeNull();
    }

    [Fact]
    public async Task ReconnectAsync_WhenItHitsAnEndpointAnotherKnownChipHolds_ReleasesItFromTheOtherChip()
    {
        _cache.Load().Returns(new List<CachedConnectionRecord>
        {
            new("ownerold", null, "10.0.0.9:80", ConnectionType.Tcp, Offline: true),
            new("claimant", null, "10.0.0.9:80", ConnectionType.Tcp, Offline: true)
        });
        // Both endpoints unstubbed at start - both miss, both stay offline, no search (both offline-only).

        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);

        var port = CreatePort(ConnectionType.Tcp);
        var device = CreateDevice("claimant", ConnectionType.Tcp, "10.0.0.9:80", port);
        _transports.CreateTcp("10.0.0.9:80").Returns(port);
        _interrogator.ReadVersion(port).Returns(new VersionReply { IsTeensyRom = true, ChipId = "claimant" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);

        var outcome = await manager.ReconnectAsync("claimant", CancellationToken.None);

        outcome.Result.Should().Be(ReconnectResult.Reconnected);
        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows =>
            rows.Any(r => r.ChipId == "claimant" && r.TcpEndpoint == "10.0.0.9:80") &&
            rows.Any(r => r.ChipId == "ownerold" && r.TcpEndpoint == null)));
    }

    // --- One occasion at a time ---

    [Fact]
    public async Task ReconnectOfB_ArrivingDuringReconnectOfA_RunsItsOwnAttemptForB()
    {
        var completionA = new TaskCompletionSource<List<TeensyRomDevice>>();
        _cache.Load().Returns(new List<CachedConnectionRecord>
        {
            new("chipaaaa", null, "10.0.0.1:80", ConnectionType.Tcp, Offline: true),
            new("chipbbbb", null, "10.0.0.2:80", ConnectionType.Tcp, Offline: true)
        });

        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);

        // A's reconnect misses its own endpoint (unstubbed) then runs a search that hangs.
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(completionA.Task);
        var reconnectA = manager.ReconnectAsync("chipaaaa", CancellationToken.None);

        var portB = CreatePort(ConnectionType.Tcp);
        var deviceB = CreateDevice("chipbbbb", ConnectionType.Tcp, "10.0.0.2:80", portB);
        _transports.CreateTcp("10.0.0.2:80").Returns(portB);
        _interrogator.ReadVersion(portB).Returns(new VersionReply { IsTeensyRom = true, ChipId = "chipbbbb" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(deviceB);

        var reconnectB = manager.ReconnectAsync("chipbbbb", CancellationToken.None);
        reconnectB.IsCompleted.Should().BeFalse("B must wait for A's occasion before running its own");

        completionA.SetResult([]);
        var outcomeB = await reconnectB;
        var outcomeA = await reconnectA;

        outcomeB.Result.Should().Be(ReconnectResult.Reconnected);
        outcomeA.Result.Should().Be(ReconnectResult.NotFound);
    }

    [Fact]
    public async Task DiscoverDevices_ArrivingDuringAReconnect_StillSweepsItsOwn()
    {
        _cache.Load().Returns(new List<CachedConnectionRecord> { new("chipaaaa", null, "10.0.0.1:80", ConnectionType.Tcp, Offline: true) });
        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);

        var completionSearch = new TaskCompletionSource<List<TeensyRomDevice>>();
        var completionSweep = new TaskCompletionSource<List<TeensyRomDevice>>();
        var calls = 0;
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(_ =>
        {
            calls++;
            return calls == 1 ? completionSearch.Task : completionSweep.Task;
        });

        var reconnect = manager.ReconnectAsync("chipaaaa", CancellationToken.None);
        var discover = manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        completionSearch.SetResult([]);
        await reconnect;
        completionSweep.SetResult([]);
        await discover;

        calls.Should().Be(2, "Discover Devices must run its own sweep rather than join the Reconnect");
    }

    [Fact]
    public async Task ReconnectAsync_ArrivingDuringAFullDiscovery_WaitsThenReportsAlreadyAvailableWhenFound()
    {
        var completion = new TaskCompletionSource<List<TeensyRomDevice>>();
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(completion.Task);

        var manager = CreateManager();
        var discover = manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        var port = CreatePort(ConnectionType.Tcp);
        var device = CreateDevice("foundbyds", ConnectionType.Tcp, "10.0.0.9:80", port);
        var reconnect = manager.ReconnectAsync("foundbyds", CancellationToken.None);

        reconnect.IsCompleted.Should().BeFalse();
        completion.SetResult([device]);

        var outcome = await reconnect;
        await discover;

        outcome.Result.Should().Be(ReconnectResult.AlreadyAvailable);
        outcome.Device.Should().Be(device);
    }

    // --- Forget ---

    [Fact]
    public async Task ForgetAsync_WhenOfflineUnit_RemovesItFromMemoryAndTheSavedFile()
    {
        _cache.Load().Returns(new List<CachedConnectionRecord> { new("forgetme", null, "10.0.0.9:80", ConnectionType.Tcp, Offline: true) });
        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);
        _cache.ClearReceivedCalls();

        var result = await manager.ForgetAsync("forgetme", CancellationToken.None);

        result.Should().Be(ForgetResult.Forgotten);
        manager.GetOfflineDevices().Should().BeEmpty();
        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows => !rows.Any()));
    }

    [Fact]
    public async Task ForgetAsync_WhenAvailable_ReturnsStillAvailableAndLeavesItUntouched()
    {
        var port = CreatePort(ConnectionType.Tcp);
        var device = CreateDevice("available", ConnectionType.Tcp, "10.0.0.9:80", port);
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { device });

        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        _cache.ClearReceivedCalls();

        var result = await manager.ForgetAsync("available", CancellationToken.None);

        result.Should().Be(ForgetResult.StillAvailable);
        manager.GetAvailableDevice("available").Should().Be(device);
        _cache.DidNotReceive().Save(Arg.Any<IEnumerable<CachedConnectionRecord>>());
    }

    [Fact]
    public async Task ForgetAsync_WhenUnknown_ReturnsUnknownDevice()
    {
        var manager = CreateManager();
        var result = await manager.ForgetAsync("nosuchchip", CancellationToken.None);

        result.Should().Be(ForgetResult.UnknownDevice);
    }

    [Fact]
    public async Task DiscoverDevices_QueuedBehindAForget_DoesNotWriteTheForgottenUnitBack()
    {
        _cache.Load().Returns(new List<CachedConnectionRecord> { new("forgetme", null, "10.0.0.9:80", ConnectionType.Tcp, Offline: true) });
        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);

        var forget = manager.ForgetAsync("forgetme", CancellationToken.None);
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice>());
        var discover = manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        await Task.WhenAll(forget, discover);

        manager.GetOfflineDevices().Should().BeEmpty();
    }

    // --- GetOfflineDevices ---

    [Fact]
    public async Task GetOfflineDevices_ExcludesStandInIds()
    {
        var port = CreatePort(ConnectionType.Serial);
        var standInDevice = CreateDevice("Unknown", ConnectionType.Serial, "COM3", port);

        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(
            new List<TeensyRomDevice> { standInDevice },
            new List<TeensyRomDevice>());

        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        manager.GetOfflineDevices().Should().BeEmpty();
    }

    [Fact]
    public async Task GetOfflineDevices_ListsAnUnreachableUnitWithItsLastKnownFacts()
    {
        var port = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("factsabc", ConnectionType.Serial, "COM3", port);
        device.Cart.FwVersion = "0.8.0.9";
        device.Cart.HardwareVariant = HardwareVariant.TeensyRomPlus;

        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(
            new List<TeensyRomDevice> { device },
            new List<TeensyRomDevice>());

        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        var offline = manager.GetOfflineDevices().Should().ContainSingle(d => d.ChipId == "factsabc").Subject;
        offline.FwVersion.Should().Be("0.8.0.9");
        offline.HardwareVariant.Should().Be(HardwareVariant.TeensyRomPlus);
        offline.IsCompatible.Should().BeTrue();
        offline.SerialPortName.Should().Be("COM3");
    }

    // --- Device names ---

    /// <summary>Returns the rows passed to the most recent <see cref="IConnectionRecordCache.Save"/>.</summary>
    private Func<List<CachedConnectionRecord>> CaptureLastSave()
    {
        List<CachedConnectionRecord> saved = [];
        _cache.When(c => c.Save(Arg.Any<IEnumerable<CachedConnectionRecord>>()))
            .Do(ci => saved = ci.Arg<IEnumerable<CachedConnectionRecord>>().ToList());
        return () => saved;
    }

    private static string? NameOf(IEnumerable<CachedConnectionRecord> rows, string chipId) =>
        rows.Single(r => r.ChipId == chipId).Name;

    [Fact]
    public async Task FindDevices_FullScan_NamesFreshChipsInChipIdOrder()
    {
        var deviceB = CreateDevice("bbbb2222", ConnectionType.Serial, "COM4", CreatePort(ConnectionType.Serial));
        var deviceA = CreateDevice("aaaa1111", ConnectionType.Serial, "COM3", CreatePort(ConnectionType.Serial));
        var lastSave = CaptureLastSave();
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { deviceB, deviceA });

        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        deviceA.Cart.Name.Should().Be("TR-1");
        deviceB.Cart.Name.Should().Be("TR-2");
        NameOf(lastSave(), "aaaa1111").Should().Be("TR-1");
        NameOf(lastSave(), "bbbb2222").Should().Be("TR-2");
    }

    [Fact]
    public async Task FindDevices_FullScan_AfterRenamingTr1_TheNextNewChipTakesTheFreedNumber()
    {
        var deviceA = CreateDevice("aaaa1111", ConnectionType.Serial, "COM3", CreatePort(ConnectionType.Serial));
        var deviceB = CreateDevice("bbbb2222", ConnectionType.Serial, "COM4", CreatePort(ConnectionType.Serial));
        var deviceC = CreateDevice("cccc3333", ConnectionType.Serial, "COM5", CreatePort(ConnectionType.Serial));
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(
            new List<TeensyRomDevice> { deviceA, deviceB },
            new List<TeensyRomDevice> { deviceA, deviceB, deviceC });

        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        await manager.RenameAsync("aaaa1111", "Kitchen", CancellationToken.None);
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        deviceC.Cart.Name.Should().Be("TR-1");
        deviceA.Cart.Name.Should().Be("Kitchen");
        deviceB.Cart.Name.Should().Be("TR-2");
    }

    [Fact]
    public async Task FindDevices_FullScan_StandInChipsShowTheirOwnIdAndNeverConsumeATrNumber()
    {
        var standIn = CreateDevice("Unknown", ConnectionType.Serial, "COM3", CreatePort(ConnectionType.Serial));
        var real = CreateDevice("aaaa1111", ConnectionType.Serial, "COM4", CreatePort(ConnectionType.Serial));
        var lastSave = CaptureLastSave();
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { standIn, real });

        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        standIn.Cart.Name.Should().Be("Unknown");
        real.Cart.Name.Should().Be("TR-1");
        lastSave().Single(r => r.ChipId == "Unknown").Name.Should().BeNull();
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithRowsThatHaveNoName_AssignsTrNumbersInChipIdOrderAndSavesThem()
    {
        _cache.Load().Returns(new List<CachedConnectionRecord>
        {
            new("bbbb2222", null, null, ConnectionType.Serial, Offline: true),
            new("aaaa1111", null, null, ConnectionType.Serial, Offline: true)
        });
        var lastSave = CaptureLastSave();

        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);

        NameOf(lastSave(), "aaaa1111").Should().Be("TR-1");
        NameOf(lastSave(), "bbbb2222").Should().Be("TR-2");
        manager.GetOfflineDevices().Select(d => (d.ChipId, d.Name)).Should().BeEquivalentTo(
            new[] { ("aaaa1111", "TR-1"), ("bbbb2222", "TR-2") });
    }

    [Fact]
    public async Task ConnectAtStartAsync_WithSomeSavedNames_KeepsThemAndGivesTheRestTheLowestFreeNumbers()
    {
        _cache.Load().Returns(new List<CachedConnectionRecord>
        {
            new("zzzz9999", null, null, ConnectionType.Serial, Offline: true, Name: "TR-1"),
            new("aaaa1111", null, null, ConnectionType.Serial, Offline: true),
            new("bbbb2222", null, null, ConnectionType.Serial, Offline: true, Name: "  "),
            new("cccc3333", null, null, ConnectionType.Serial, Offline: true, Name: "Kitchen")
        });
        var lastSave = CaptureLastSave();

        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);

        NameOf(lastSave(), "zzzz9999").Should().Be("TR-1");
        NameOf(lastSave(), "cccc3333").Should().Be("Kitchen");
        NameOf(lastSave(), "aaaa1111").Should().Be("TR-2");
        NameOf(lastSave(), "bbbb2222").Should().Be("TR-3");
    }

    [Fact]
    public async Task ConnectAtStartAsync_WhenAConfirmedRowHadASavedName_TheRebuiltDeviceCarriesIt()
    {
        var port = CreatePort(ConnectionType.Serial);
        var device = CreateDevice("11112222", ConnectionType.Serial, "COM5", port);
        _cache.Load().Returns(new List<CachedConnectionRecord> { new("11112222", "COM5", null, ConnectionType.Serial, Name: "Kitchen") });
        AllowSerialLookup("11112222", "COM5");
        _transports.CreateSerial("COM5", true).Returns(port);
        _interrogator.ReadVersion(port).Returns(new VersionReply { IsTeensyRom = true, ChipId = "11112222" });
        _finder.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(device);

        var manager = CreateManager();
        var started = await manager.ConnectAtStartAsync(CancellationToken.None);

        started.Should().ContainSingle().Which.Cart.Name.Should().Be("Kitchen");
    }

    [Fact]
    public async Task RenameAsync_WhenAvailable_StampsTheDeviceReturnsItAndSavesTheName()
    {
        var device = CreateDevice("aaaa1111", ConnectionType.Serial, "COM3", CreatePort(ConnectionType.Serial));
        var lastSave = CaptureLastSave();
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { device });
        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        var outcome = await manager.RenameAsync("aaaa1111", "  Kitchen ", CancellationToken.None);

        outcome.Result.Should().Be(RenameResult.Renamed);
        outcome.Device.Should().BeSameAs(device);
        outcome.OfflineDevice.Should().BeNull();
        device.Cart.Name.Should().Be("Kitchen");
        NameOf(lastSave(), "aaaa1111").Should().Be("Kitchen");
    }

    [Fact]
    public async Task RenameAsync_WhenOnlyKnownFromTheSavedFile_ReturnsTheOfflineDeviceAndSavesTheName()
    {
        _cache.Load().Returns(new List<CachedConnectionRecord> { new("aaaa1111", null, null, ConnectionType.Serial, Offline: true) });
        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);
        var lastSave = CaptureLastSave();

        var outcome = await manager.RenameAsync("aaaa1111", "Kitchen", CancellationToken.None);

        outcome.Result.Should().Be(RenameResult.Renamed);
        outcome.Device.Should().BeNull();
        outcome.OfflineDevice!.Name.Should().Be("Kitchen");
        manager.GetOfflineDevices().Should().ContainSingle().Which.Name.Should().Be("Kitchen");
        NameOf(lastSave(), "aaaa1111").Should().Be("Kitchen");
    }

    [Fact]
    public async Task RenameAsync_WhenTheUnitIsUnreachable_ReturnsTheOfflineDevice()
    {
        var device = CreateDevice("aaaa1111", ConnectionType.Serial, "COM3", CreatePort(ConnectionType.Serial));
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(
            new List<TeensyRomDevice> { device },
            new List<TeensyRomDevice>());
        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        var outcome = await manager.RenameAsync("aaaa1111", "Kitchen", CancellationToken.None);

        outcome.Result.Should().Be(RenameResult.Renamed);
        outcome.Device.Should().BeNull();
        outcome.OfflineDevice!.ChipId.Should().Be("aaaa1111");
        outcome.OfflineDevice.Name.Should().Be("Kitchen");
    }

    [Fact]
    public async Task RenameAsync_ForAStandInOrUnknownChip_IsUnknownDeviceAndSavesNothing()
    {
        var standIn = CreateDevice("Unknown", ConnectionType.Serial, "COM3", CreatePort(ConnectionType.Serial));
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { standIn });
        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        _cache.ClearReceivedCalls();

        var standInOutcome = await manager.RenameAsync("Unknown", "Kitchen", CancellationToken.None);
        var unknownOutcome = await manager.RenameAsync("nosuchchip", "Kitchen", CancellationToken.None);

        standInOutcome.Result.Should().Be(RenameResult.UnknownDevice);
        unknownOutcome.Result.Should().Be(RenameResult.UnknownDevice);
        standIn.Cart.Name.Should().Be("Unknown");
        _cache.DidNotReceive().Save(Arg.Any<IEnumerable<CachedConnectionRecord>>());
    }

    [Theory]
    [InlineData("  ")]
    [InlineData("")]
    [InlineData("1234567890123456789012345")]
    [InlineData("bad\tname")]
    public async Task RenameAsync_WithAnInvalidName_IsInvalidNameAndChangesNothing(string name)
    {
        var device = CreateDevice("aaaa1111", ConnectionType.Serial, "COM3", CreatePort(ConnectionType.Serial));
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { device });
        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        _cache.ClearReceivedCalls();

        var outcome = await manager.RenameAsync("aaaa1111", name, CancellationToken.None);

        outcome.Result.Should().Be(RenameResult.InvalidName);
        device.Cart.Name.Should().Be("TR-1");
        _cache.DidNotReceive().Save(Arg.Any<IEnumerable<CachedConnectionRecord>>());
    }

    [Fact]
    public async Task RenameAsync_WhileADiscoveryIsRunning_CompletesWithoutWaitingForIt()
    {
        var device = CreateDevice("aaaa1111", ConnectionType.Serial, "COM3", CreatePort(ConnectionType.Serial));
        var sweepGate = new TaskCompletionSource<List<TeensyRomDevice>>();
        var lastSave = CaptureLastSave();
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(
            Task.FromResult(new List<TeensyRomDevice> { device }),
            sweepGate.Task);
        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        var sweep = manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        var rename = manager.RenameAsync("aaaa1111", "Kitchen", CancellationToken.None);

        rename.IsCompleted.Should().BeTrue();
        (await rename).Result.Should().Be(RenameResult.Renamed);

        var rebuilt = CreateDevice("aaaa1111", ConnectionType.Serial, "COM3", CreatePort(ConnectionType.Serial));
        sweepGate.SetResult([rebuilt]);
        await sweep;

        rebuilt.Cart.Name.Should().Be("Kitchen");
        NameOf(lastSave(), "aaaa1111").Should().Be("Kitchen");
    }

    [Fact]
    public async Task FindDevices_FullScan_RebuiltDeviceKeepsItsRenamedName()
    {
        var original = CreateDevice("aaaa1111", ConnectionType.Serial, "COM3", CreatePort(ConnectionType.Serial));
        var rebuilt = CreateDevice("aaaa1111", ConnectionType.Serial, "COM3", CreatePort(ConnectionType.Serial));
        rebuilt.Cart.Name.Should().Be("Unnamed");
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(
            new List<TeensyRomDevice> { original },
            new List<TeensyRomDevice> { rebuilt });
        var manager = CreateManager();
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        await manager.RenameAsync("aaaa1111", "Kitchen", CancellationToken.None);

        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        manager.GetAvailableDevice("aaaa1111").Should().BeSameAs(rebuilt);
        rebuilt.Cart.Name.Should().Be("Kitchen");
    }

    [Fact]
    public async Task ReconnectAsync_RebuiltDeviceKeepsItsRenamedNameAndTheSavedRowCarriesIt()
    {
        var staleDevice = CreateDevice("reconnct", ConnectionType.Tcp, "10.0.0.9:80", CreatePort(ConnectionType.Tcp));
        var finderStub = Substitute.For<ICartFinder>();
        var manager = new DeviceConnectionManager(finderStub, _cache, _transports, _interrogator, _locator, _options, _log);
        finderStub.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(
            new List<TeensyRomDevice> { staleDevice },
            new List<TeensyRomDevice>());
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);
        await manager.RenameAsync("reconnct", "Kitchen", CancellationToken.None);

        var freshPort = CreatePort(ConnectionType.Tcp);
        var freshDevice = CreateDevice("reconnct", ConnectionType.Tcp, "10.0.0.9:80", freshPort);
        _transports.CreateTcp("10.0.0.9:80").Returns(freshPort);
        _interrogator.ReadVersion(freshPort).Returns(new VersionReply { IsTeensyRom = true, ChipId = "reconnct" });
        finderStub.BuildDevice(Arg.Any<DiscoveredEndpoint>(), Arg.Any<CancellationToken>()).Returns(freshDevice);
        _cache.ClearReceivedCalls();

        var outcome = await manager.ReconnectAsync("reconnct", CancellationToken.None);

        outcome.Result.Should().Be(ReconnectResult.Reconnected);
        freshDevice.Cart.Name.Should().Be("Kitchen");
        _cache.Received(1).Save(Arg.Is<IEnumerable<CachedConnectionRecord>>(rows => rows.Single().Name == "Kitchen"));
    }

    [Fact]
    public async Task ForgetAsync_ThenTheUnitReturns_GetsAFreshTrNumber()
    {
        _cache.Load().Returns(new List<CachedConnectionRecord>
        {
            new("aaaa1111", null, null, ConnectionType.Serial, Offline: true, Name: "Kitchen"),
            new("bbbb2222", null, null, ConnectionType.Serial, Offline: true)
        });
        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);
        manager.GetOfflineDevices().Single(d => d.ChipId == "bbbb2222").Name.Should().Be("TR-1");

        (await manager.ForgetAsync("aaaa1111", CancellationToken.None)).Should().Be(ForgetResult.Forgotten);
        var returning = CreateDevice("aaaa1111", ConnectionType.Serial, "COM3", CreatePort(ConnectionType.Serial));
        _finder.FindDevices(Arg.Any<IReadOnlySet<string>>(), Arg.Any<CancellationToken>()).Returns(new List<TeensyRomDevice> { returning });
        await manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true);

        returning.Cart.Name.Should().Be("TR-2");
    }

    [Fact]
    public async Task ForgetAsync_ThenRenameOfTheForgottenUnit_IsUnknownDevice()
    {
        _cache.Load().Returns(new List<CachedConnectionRecord> { new("aaaa1111", null, null, ConnectionType.Serial, Offline: true) });
        var manager = CreateManager();
        await manager.ConnectAtStartAsync(CancellationToken.None);
        await manager.ForgetAsync("aaaa1111", CancellationToken.None);

        var outcome = await manager.RenameAsync("aaaa1111", "Kitchen", CancellationToken.None);

        outcome.Result.Should().Be(RenameResult.UnknownDevice);
    }
}
