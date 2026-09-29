using System.Net;
using System.Net.Sockets;
using TeensyRom.Core.Entities.Serial;

namespace TeensyRom.Core.Device.Tests.Unit.Discovery;

/// <summary>
/// Unit tests for <see cref="TcpDiscoveryStrategy"/>'s per-address probe, isolated from the subnet
/// sweep via a fake <see cref="ITcpProbe"/> so no test opens a real socket.
/// </summary>
public class TcpDiscoveryStrategyTests
{
    private static readonly IPAddress Address = IPAddress.Parse("192.168.1.42");
    private const int Port = 2112;

    private readonly ILoggingService _log;
    private readonly IDeviceInterrogator _interrogator;
    private readonly ITcpProbe _probe;

    public TcpDiscoveryStrategyTests()
    {
        _log = Substitute.For<ILoggingService>();
        _interrogator = Substitute.For<IDeviceInterrogator>();
        _probe = Substitute.For<ITcpProbe>();
    }

    private TcpDiscoveryStrategy CreateSut(IDeviceInterrogator? interrogator = null) =>
        new(_log, interrogator ?? _interrogator, _probe);

    private static VersionReply TeensyRomReply() => VersionReply.Empty with { IsTeensyRom = true };

    [Fact]
    public async Task ProbeAddress_WhenConnectedAndVersionReplyIsTeensyRom_ReturnsOpenEndpointWithVersion()
    {
        var port = Substitute.For<ICommunicationPort>();
        port.IsOpen.Returns(true);
        _probe.Connect(Address, Port).Returns(port);
        var reply = TeensyRomReply();
        _interrogator.ReadVersion(port).Returns(reply);

        var endpoint = await CreateSut().ProbeAddress(Address, Port);

        endpoint.Should().NotBeNull();
        endpoint!.Version.IsTeensyRom.Should().BeTrue();
        endpoint.ConnectionType.Should().Be(ConnectionType.Tcp);
        endpoint.Address.Should().Be(Address.ToString());
        endpoint.Port.Should().Be(Port);
        endpoint.CommunicationPort.Should().BeSameAs(port);
        endpoint.CommunicationPort.IsOpen.Should().BeTrue();
    }

    [Fact]
    public async Task ProbeAddress_WhenConnectedButNoVersionReply_ReturnsNullDisposesPortAndLogsAddress()
    {
        var port = Substitute.For<ICommunicationPort>();
        _probe.Connect(Address, Port).Returns(port);
        _interrogator.ReadVersion(port).Returns(VersionReply.Empty);

        var endpoint = await CreateSut().ProbeAddress(Address, Port);

        endpoint.Should().BeNull();
        port.Received(1).Dispose();
        _log.Received(1).Internal(Arg.Is<string>(s =>
            s.Contains(Address.ToString()) && s.Contains("connected but no version reply") && s.Contains("empty")));
    }

    [Fact]
    public async Task ProbeAddress_WhenConnectRefused_PropagatesSocketExceptionForSweepToClassify()
    {
        _probe.Connect(Address, Port).Returns(Task.FromException<ICommunicationPort>(new SocketException((int)SocketError.ConnectionRefused)));

        var act = () => CreateSut().ProbeAddress(Address, Port);

        await act.Should().ThrowAsync<SocketException>();
    }

    [Fact]
    public async Task ProbeAddress_WhenConnectTimesOut_PropagatesTimeoutExceptionForSweepToClassify()
    {
        _probe.Connect(Address, Port).Returns(Task.FromException<ICommunicationPort>(new TimeoutException("connect timed out")));

        var act = () => CreateSut().ProbeAddress(Address, Port);

        await act.Should().ThrowAsync<TimeoutException>();
    }

    /// <summary>
    /// Runs the real <see cref="DeviceInterrogator"/> against a scripted port so the bytes actually
    /// written can be inspected: the version probe must write only VersionInfo (0x64, 0x76), never the
    /// retired FwCheckToken (0x64E0) or Ping (0x6455).
    /// </summary>
    [Fact]
    public async Task ProbeAddress_WritesOnlyVersionInfoToken_NeverFwCheckOrPingTokens()
    {
        var scriptedPort = new ScriptedCommunicationPort();
        scriptedPort.NewSegment().EnqueueToken(TeensyToken.Ack).EnqueueText("FW: TeensyROM+ v0.8.0.9\n");
        _probe.Connect(Address, Port).Returns(scriptedPort);

        var sut = CreateSut(new DeviceInterrogator(_log));

        var endpoint = await sut.ProbeAddress(Address, Port);

        endpoint.Should().NotBeNull();
        endpoint!.Version.IsTeensyRom.Should().BeTrue();
        scriptedPort.Written.Should().Equal((byte)0x64, (byte)0x76);
    }
}
