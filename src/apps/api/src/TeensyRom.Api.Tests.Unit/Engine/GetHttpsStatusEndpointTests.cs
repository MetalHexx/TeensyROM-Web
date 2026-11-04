using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using RadEndpoints.Testing;
using TeensyRom.Api.Endpoints.Engine.GetHttpsStatus;
using TeensyRom.Api.Https;

namespace TeensyRom.Api.Tests.Engine;

public class GetHttpsStatusEndpointTests
{
    [Fact]
    public async Task Handle_WithCertificate_MapsTheStateAndTheCertificateChange()
    {
        var issued = DateTimeOffset.Parse("2026-01-01T00:00:00Z");
        var expires = issued.AddDays(730);
        var certificate = new HttpsCertificateResult(
            null, HttpsCertificateChange.Reissued, HttpsCertificateChangeReason.NewAddress,
            ["box", "192.168.1.5"], issued, expires, null);

        var response = await Send(new HttpsState(10214, true, null, certificate));

        response.Should().BeEquivalentTo(new GetHttpsStatusResponse
        {
            Port = 10214,
            Listening = true,
            Names = ["box", "192.168.1.5"],
            IssuedAt = issued,
            ExpiresAt = expires,
            Change = HttpsCertificateChange.Reissued,
            ChangeReason = HttpsCertificateChangeReason.NewAddress
        });
    }

    [Fact]
    public async Task Handle_WithoutCertificate_ReportsTheProblemAndEmptyCertificateFields()
    {
        var response = await Send(new HttpsState(10214, false, "Port 10214 is in use.", null));

        response.Should().BeEquivalentTo(new GetHttpsStatusResponse
        {
            Port = 10214,
            Listening = false,
            Problem = "Port 10214 is in use.",
            Change = HttpsCertificateChange.None
        });
    }

    private static async Task<GetHttpsStatusResponse> Send(HttpsState state)
    {
        var endpoint = EndpointFactory.CreateEndpoint<GetHttpsStatusEndpoint>(
            Substitute.For<ILogger<GetHttpsStatusEndpoint>>(),
            new HttpContextAccessor { HttpContext = new DefaultHttpContext() },
            Substitute.For<IWebHostEnvironment>(),
            state);

        await endpoint.Handle(CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(System.Net.HttpStatusCode.OK);
        return endpoint.Response;
    }
}
