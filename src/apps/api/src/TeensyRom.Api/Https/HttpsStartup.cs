using Microsoft.AspNetCore.Server.Kestrel.Core;
using System.Net;
using System.Net.Sockets;
using TeensyRom.Core.Common;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;

namespace TeensyRom.Api.Https;

/// <summary>What HTTPS did for this engine run. Registered as a singleton; read by the status endpoint.</summary>
public sealed record HttpsState(
    int Port, bool Listening, string? Problem, HttpsCertificateResult? Certificate);

public static class HttpsStartup
{
    private const int DefaultHttpsPort = 10214;
    private const int DefaultHttpPort = 10213;

    /// <summary>
    /// Reads Https:Port, ensures the certificate, checks the port is free, and adds an HTTPS-only Kestrel listener
    /// on IPAddress.Any. Registers HttpsState. Never throws: any failure leaves http alone and records Problem.
    /// </summary>
    public static HttpsState AddEngineHttps(this WebApplicationBuilder builder, bool enabled)
    {
        var port = DefaultHttpsPort;
        HttpsState state;

        try
        {
            port = builder.Configuration.GetValue("Https:Port", DefaultHttpsPort);

            if (!enabled)
            {
                state = new HttpsState(port, false, "HTTPS is off for document generation.", null);
            }
            else
            {
                var certificate = new HttpsCertificateStore(TeensyRomHome.HttpsPath, TimeProvider.System)
                    .Ensure(Dns.GetHostName(), NetworkHelper.GetLocalAddresses());

                state = Decide(port, ReadHttpPort(builder.Configuration), certificate, IsPortFree);

                if (state.Listening)
                {
                    var serverCertificate = certificate.Certificate!;
                    builder.WebHost.ConfigureKestrel(options =>
                        options.Listen(IPAddress.Any, port, listen => listen.UseHttps(serverCertificate)));
                }
            }
        }
        catch (Exception ex)
        {
            state = new HttpsState(port, false, $"HTTPS setup failed ({ex.Message}), so Trom API serves http only.", null);
        }

        builder.Services.AddSingleton(state);
        return state;
    }

    /// <summary>
    /// The pure decision AddEngineHttps delegates to; the unit tests target this. A null Certificate, a port outside
    /// 1–65535, a port equal to httpPort, or portFree(port) == false each give Listening: false with a Problem.
    /// </summary>
    public static HttpsState Decide(int port, int httpPort, HttpsCertificateResult certificate, Func<int, bool> portFree)
    {
        if (certificate.Certificate is null)
        {
            var reason = certificate.Problem ?? "no certificate is available";
            return new HttpsState(port, false, $"HTTPS is off: {reason}", certificate);
        }

        if (port is < 1 or > 65535)
        {
            return new HttpsState(port, false, $"Https:Port {port} is not a valid port, so Trom API serves http only.", certificate);
        }

        if (port == httpPort)
        {
            return new HttpsState(port, false, $"Https:Port {port} is the http port, so Trom API serves http only.", certificate);
        }

        if (!portFree(port))
        {
            return new HttpsState(port, false, $"Port {port} is in use, so Trom API serves http only.", certificate);
        }

        return new HttpsState(port, true, null, certificate);
    }

    /// <summary>Logs a created or re-issued certificate (with its reason) or an HTTPS problem, to the engine log and the console.</summary>
    public static void ReportEngineHttps(this WebApplication app)
    {
        var state = app.Services.GetRequiredService<HttpsState>();
        var logger = app.Services.GetRequiredService<ILoggingService>();

        switch (state.Certificate?.Change)
        {
            case HttpsCertificateChange.Created:
                var created = $"Created the HTTPS certificate for https://{Dns.GetHostName()}:{state.Port}. Browsers warn once because it is self-signed.";
                logger.InternalSuccess(created);
                Console.WriteLine(created);
                break;
            case HttpsCertificateChange.Reissued:
                var reissued = $"Re-issued the HTTPS certificate ({state.Certificate.Reason}). Browsers that accepted the old one will warn again.";
                logger.InternalWarning(reissued);
                Console.WriteLine(reissued);
                break;
        }

        if (state.Problem is not null)
        {
            logger.InternalWarning(state.Problem);
            Console.WriteLine(state.Problem);
        }
    }

    private static int ReadHttpPort(IConfiguration configuration)
    {
        var url = configuration["Kestrel:Endpoints:Http:Url"];

        return Uri.TryCreate(url, UriKind.Absolute, out var uri) ? uri.Port : DefaultHttpPort;
    }

    /// <summary>Binds and releases the port; the gap before Kestrel binds it is accepted.</summary>
    public static bool IsPortFree(int port)
    {
        var listener = new TcpListener(IPAddress.Any, port);

        if (OperatingSystem.IsWindows())
        {
            listener.ExclusiveAddressUse = true;
        }

        try
        {
            listener.Start();
            return true;
        }
        catch (SocketException)
        {
            return false;
        }
        finally
        {
            listener.Stop();
        }
    }
}
