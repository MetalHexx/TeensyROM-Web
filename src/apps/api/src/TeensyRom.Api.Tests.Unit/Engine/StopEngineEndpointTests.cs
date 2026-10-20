using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using RadEndpoints.Testing;
using System.Net;
using TeensyRom.Api.Endpoints.Engine.StopEngine;
using TeensyRom.Api.Http;
using TeensyRom.Api.Services;

namespace TeensyRom.Api.Tests.Engine;

public class StopEngineEndpointTests
{
    private readonly IEngineShutdown _shutdown = Substitute.For<IEngineShutdown>();

    [Theory]
    [InlineData("127.0.0.1")]
    [InlineData("::1")]
    [InlineData("::ffff:127.0.0.1")]
    public async Task Handle_LoopbackCaller_SendsOkAndRequestsStop(string remote)
    {
        var endpoint = CreateEndpoint(IPAddress.Parse(remote));

        await endpoint.Handle(CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(System.Net.HttpStatusCode.OK);
        _shutdown.Received(1).RequestStop();
    }

    [Theory]
    [InlineData("192.168.1.5")]
    [InlineData("2001:db8::1")]
    [InlineData(null)]
    public async Task Handle_RemoteCaller_SendsForbiddenAndDoesNotStop(string? remote)
    {
        var endpoint = CreateEndpoint(remote is null ? null : IPAddress.Parse(remote));

        await endpoint.Handle(CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(System.Net.HttpStatusCode.Forbidden);
        _shutdown.DidNotReceive().RequestStop();
    }

    [Theory]
    [InlineData("127.0.0.1", true)]
    [InlineData("127.1.2.3", true)]
    [InlineData("::1", true)]
    [InlineData("::ffff:127.0.0.1", true)]
    [InlineData("192.168.1.5", false)]
    [InlineData("::ffff:192.168.1.5", false)]
    [InlineData("0.0.0.0", false)]
    [InlineData("2001:db8::1", false)]
    public void IsLoopback_ClassifiesTheAddress(string address, bool expected)
    {
        LocalCaller.IsLoopback(IPAddress.Parse(address)).Should().Be(expected);
    }

    [Fact]
    public void IsLoopback_MissingAddress_IsFalse()
    {
        LocalCaller.IsLoopback(null).Should().BeFalse();
    }

    private StopEngineEndpoint CreateEndpoint(IPAddress? remote)
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = remote;

        return EndpointFactory.CreateEndpoint<StopEngineEndpoint>(
            Substitute.For<ILogger<StopEngineEndpoint>>(),
            new HttpContextAccessor { HttpContext = context },
            Substitute.For<IWebHostEnvironment>(),
            _shutdown);
    }
}
