using TeensyRom.Core.Serial.Usb;

namespace TeensyRom.Core.Device.Tests.Unit.Discovery;

/// <summary>
/// Unit tests for <see cref="SerialDiscoveryStrategy"/>: which ports get opened, and how a candidate
/// port's outcome (TeensyROM reply, empty reply, open failure) is handled.
/// </summary>
public class SerialDiscoveryStrategyTests
{
    private readonly ILoggingService _log;
    private readonly IDeviceTransportFactory _transportFactory;
    private readonly ITeensyPortLocator _locator;
    private readonly IDeviceInterrogator _interrogator;

    public SerialDiscoveryStrategyTests()
    {
        _log = Substitute.For<ILoggingService>();
        _transportFactory = Substitute.For<IDeviceTransportFactory>();
        _locator = Substitute.For<ITeensyPortLocator>();
        _interrogator = Substitute.For<IDeviceInterrogator>();
    }

    private SerialDiscoveryStrategy CreateSut() => new(_log, _transportFactory, _locator, _interrogator);

    private static ICommunicationPort CreatePort() => Substitute.For<ICommunicationPort>();

    private static VersionReply TeensyRomReply(string? chipId = null) =>
        VersionReply.Empty with { IsTeensyRom = true, ChipId = chipId };

    [Fact]
    public async Task FindEndpoints_WhenLocatorAvailable_OpensExactlyTheNamedPortsAndSkipsForeignPorts()
    {
        _locator.ListPorts().Returns(new PortLocatorResult(
            [new TeensyRomPort("COM3", "chip-1", TeensyRomImage.Full), new TeensyRomPort("COM5", "chip-2", TeensyRomImage.Full)],
            FilterAvailable: true,
            UnavailableReason: null));

        var port3 = CreatePort();
        var port5 = CreatePort();
        _transportFactory.CreateSerial("COM3").Returns(port3);
        _transportFactory.CreateSerial("COM5").Returns(port5);
        _interrogator.ReadVersion(port3).Returns(TeensyRomReply("chip-1"));
        _interrogator.ReadVersion(port5).Returns(TeensyRomReply("chip-2"));

        var result = await CreateSut().FindEndpoints(CancellationToken.None);

        result.Should().HaveCount(2);
        _transportFactory.Received(1).CreateSerial("COM3");
        _transportFactory.Received(1).CreateSerial("COM5");
        _transportFactory.Received(2).CreateSerial(Arg.Any<string>());
        port3.Received(1).OpenPort(useRetryLoop: false);
        port5.Received(1).OpenPort(useRetryLoop: false);
    }

    [Fact]
    public async Task FindEndpoints_WhenLocatorUnavailable_ProbesEveryPresentPortAndLogsOneWarning()
    {
        _locator.ListPorts().Returns(new PortLocatorResult([], FilterAvailable: false, UnavailableReason: "no USB descriptor reader supports this platform"));
        _interrogator.ReadVersion(Arg.Any<ICommunicationPort>()).Returns(VersionReply.Empty);
        _transportFactory.CreateSerial(Arg.Any<string>()).Returns(_ => CreatePort());

        var expectedPorts = SerialHelper.GetComPorts();

        await CreateSut().FindEndpoints(CancellationToken.None);

        _log.Received(1).InternalWarning(Arg.Is<string>(s =>
            s.Contains("descriptor filter unavailable") && s.Contains("no USB descriptor reader supports this platform")));
        _transportFactory.Received(expectedPorts.Count).CreateSerial(Arg.Any<string>());
    }

    [Fact]
    public async Task FindEndpoints_WhenVersionReplyEmpty_ReturnsNoEndpointLogsPortNameAndDisposesPort()
    {
        _locator.ListPorts().Returns(new PortLocatorResult(
            [new TeensyRomPort("COM3", "chip-1", TeensyRomImage.Full)], FilterAvailable: true, UnavailableReason: null));

        var port = CreatePort();
        _transportFactory.CreateSerial("COM3").Returns(port);
        _interrogator.ReadVersion(port).Returns(VersionReply.Empty);

        var result = await CreateSut().FindEndpoints(CancellationToken.None);

        result.Should().BeEmpty();
        _log.Received(1).Internal(Arg.Is<string>(s => s.Contains("COM3") && s.Contains("no version reply") && s.Contains("empty")));
        port.Received(1).Dispose();
    }

    [Fact]
    public async Task FindEndpoints_WhenOpenThrows_SkipsPortAndLogsExceptionMessage()
    {
        _locator.ListPorts().Returns(new PortLocatorResult(
            [new TeensyRomPort("COM3", "chip-1", TeensyRomImage.Full)], FilterAvailable: true, UnavailableReason: null));

        var port = CreatePort();
        port.When(p => p.OpenPort(Arg.Any<bool>())).Do(_ => throw new InvalidOperationException("port busy"));
        _transportFactory.CreateSerial("COM3").Returns(port);

        var result = await CreateSut().FindEndpoints(CancellationToken.None);

        result.Should().BeEmpty();
        _log.Received(1).Internal(Arg.Is<string>(s => s.Contains("COM3") && s.Contains("port busy")));
        port.Received(1).Dispose();
        _interrogator.DidNotReceive().ReadVersion(Arg.Any<ICommunicationPort>());
    }

    [Fact]
    public async Task FindEndpoints_ReturnedEndpoints_CarryTeensyRomVersionAndOpenPort()
    {
        _locator.ListPorts().Returns(new PortLocatorResult(
            [new TeensyRomPort("COM3", "chip-1", TeensyRomImage.Full)], FilterAvailable: true, UnavailableReason: null));

        var port = CreatePort();
        port.IsOpen.Returns(true);
        _transportFactory.CreateSerial("COM3").Returns(port);
        _interrogator.ReadVersion(port).Returns(TeensyRomReply("chip-1"));

        var result = await CreateSut().FindEndpoints(CancellationToken.None);

        result.Should().ContainSingle();
        var endpoint = result.Single();
        endpoint.Version.IsTeensyRom.Should().BeTrue();
        endpoint.CommunicationPort.IsOpen.Should().BeTrue();
        endpoint.Address.Should().Be("COM3");
        endpoint.Port.Should().BeNull();
        endpoint.Display.Should().Be("COM3");
    }

    [Fact]
    public async Task FindEndpoints_WhenReplyChipIdDiffersFromDescriptor_LogsMismatchAndTrustsReply()
    {
        _locator.ListPorts().Returns(new PortLocatorResult(
            [new TeensyRomPort("COM3", "descriptor-chip", TeensyRomImage.Full)], FilterAvailable: true, UnavailableReason: null));

        var port = CreatePort();
        _transportFactory.CreateSerial("COM3").Returns(port);
        _interrogator.ReadVersion(port).Returns(TeensyRomReply("reply-chip"));

        var result = await CreateSut().FindEndpoints(CancellationToken.None);

        result.Should().ContainSingle();
        result.Single().Version.ChipId.Should().Be("reply-chip");
        _log.Received(1).Internal(Arg.Is<string>(s => s.Contains("descriptor says descriptor-chip, reply says reply-chip")));
    }
}
