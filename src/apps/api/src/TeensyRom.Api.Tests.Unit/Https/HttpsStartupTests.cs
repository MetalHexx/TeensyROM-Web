using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using TeensyRom.Api.Https;

namespace TeensyRom.Api.Tests.Https;

public class HttpsStartupTests : IDisposable
{
    private const int HttpPort = 10213;

    private readonly X509Certificate2 _certificate = CreateCertificate();

    public void Dispose() => _certificate.Dispose();

    [Fact]
    public void Decide_FreeValidPort_Listens()
    {
        var state = HttpsStartup.Decide(10214, HttpPort, WithCertificate(), _ => true);

        state.Listening.Should().BeTrue();
        state.Problem.Should().BeNull();
        state.Port.Should().Be(10214);
    }

    [Fact]
    public void Decide_NoCertificate_DoesNotListenAndCarriesTheCertificateProblem()
    {
        var none = new HttpsCertificateResult(null, HttpsCertificateChange.None, null, [], null, null, "disk is read-only");

        var state = HttpsStartup.Decide(10214, HttpPort, none, _ => true);

        state.Listening.Should().BeFalse();
        state.Problem.Should().Contain("disk is read-only");
    }

    [Fact]
    public void Decide_PortInUse_DoesNotListen()
    {
        var state = HttpsStartup.Decide(10214, HttpPort, WithCertificate(), _ => false);

        state.Listening.Should().BeFalse();
        state.Problem.Should().Contain("10214").And.Contain("in use");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(65536)]
    [InlineData(HttpPort)]
    public void Decide_PortOutOfRangeOrSameAsHttp_DoesNotListenAndNeverChecksThePort(int port)
    {
        var state = HttpsStartup.Decide(port, HttpPort, WithCertificate(), _ => throw new InvalidOperationException("checked"));

        state.Listening.Should().BeFalse();
        state.Problem.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void IsPortFree_PortHeldByAListener_IsFalse()
    {
        var holder = new TcpListener(IPAddress.Any, 0);
        holder.Start();

        try
        {
            HttpsStartup.IsPortFree(((IPEndPoint)holder.LocalEndpoint).Port).Should().BeFalse();
        }
        finally
        {
            holder.Stop();
        }
    }

    [Fact]
    public void IsPortFree_ReleasedPort_IsTrue()
    {
        var probe = new TcpListener(IPAddress.Any, 0);
        probe.Start();
        var port = ((IPEndPoint)probe.LocalEndpoint).Port;
        probe.Stop();

        HttpsStartup.IsPortFree(port).Should().BeTrue();
    }

    private HttpsCertificateResult WithCertificate() => new(
        _certificate, HttpsCertificateChange.Created, null, ["localhost"], DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddYears(1), null);

    private static X509Certificate2 CreateCertificate()
    {
        using var key = RSA.Create(2048);
        var request = new CertificateRequest("CN=test", key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

        return request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(1));
    }
}
