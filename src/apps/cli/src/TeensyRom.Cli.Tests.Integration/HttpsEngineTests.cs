using Microsoft.AspNetCore.SignalR.Client;
using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Text.Json;
using TeensyRom.Cli.Common;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// The real engine's HTTPS listener, beside http. The engine's self-signed certificate is not trusted here, so the
/// clients accept any certificate; what is proven is that Kestrel serves the same app over TLS.
/// </summary>
[Collection(RealApiCollection.Name)]
public sealed class HttpsEngineTests
{
    private const string HttpUrl = "http://127.0.0.1:10213";
    private const string HttpsUrl = "https://127.0.0.1:10214";

    [Fact]
    public async Task Engine_ServesTheSameApiAndUi_OverHttpsAsOverHttp()
    {
        using var bound = TestEngine.Bounded();
        await TestEngine.EnsureAsync(bound.Token);
        using var http = new HttpClient();
        using var https = NewTrustAllClient();

        var httpVersion = await http.GetStringAsync($"{HttpUrl}/api/version", bound.Token);
        var httpsVersion = await https.GetStringAsync($"{HttpsUrl}/api/version", bound.Token);
        using var httpRoot = await http.GetAsync($"{HttpUrl}/", bound.Token);
        using var httpsRoot = await https.GetAsync($"{HttpsUrl}/", bound.Token);

        httpsVersion.Should().Be(httpVersion);
        httpsRoot.StatusCode.Should().Be(httpRoot.StatusCode, "the SPA fallback is the same route over both schemes");
        httpsRoot.Content.Headers.ContentType?.MediaType.Should().Be(httpRoot.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task LogHub_StartsAndSubscribes_OverHttps()
    {
        using var bound = TestEngine.Bounded();
        await TestEngine.EnsureAsync(bound.Token);

        await using var connection = new HubConnectionBuilder()
            .WithUrl($"{HttpsUrl}/api/logHub", options =>
            {
                options.HttpMessageHandlerFactory = _ => new HttpClientHandler { ServerCertificateCustomValidationCallback = (_, _, _, _) => true };
                options.WebSocketConfiguration = socket => socket.RemoteCertificateValidationCallback = (_, _, _, _) => true;
            })
            .Build();

        await connection.StartAsync(bound.Token);
        await connection.InvokeAsync("Subscribe", bound.Token);

        connection.State.Should().Be(HubConnectionState.Connected);
    }

    [Fact]
    public async Task HttpsStatus_ReportsTheListenerAndTheCertificate()
    {
        using var bound = TestEngine.Bounded();
        await TestEngine.EnsureAsync(bound.Token);
        using var https = NewTrustAllClient();

        var status = (await https.GetFromJsonAsync<JsonElement>($"{HttpsUrl}/api/engine/https", bound.Token));

        status.GetProperty("port").GetInt32().Should().Be(10214);
        status.GetProperty("listening").GetBoolean().Should().BeTrue(status.GetRawText());
        status.GetProperty("names").GetArrayLength().Should().BeGreaterThan(0);
        status.GetProperty("change").GetString().Should().BeOneOf("None", "Created", "Reissued");
    }

    [Fact]
    public async Task Engine_WithTheHttpsPortOccupied_ServesHttpAndReportsWhy()
    {
        using var bound = TestEngine.Bounded();
        var home = TestEngine.NewScenarioHome();
        var passed = false;

        await TestEngine.StopAsync(bound.Token);
        Environment.SetEnvironmentVariable(TeensyRomHome.DataDirVariable, home);
        var holder = new TcpListener(IPAddress.Any, 10214) { ExclusiveAddressUse = OperatingSystem.IsWindows() };
        holder.Start();

        try
        {
            using var cli = new CliHarness();

            (await cli.RunAsync("device", "list")).Should().Be(0);

            using var http = new HttpClient();
            (await http.GetAsync($"{HttpUrl}/api/version", bound.Token)).IsSuccessStatusCode.Should().BeTrue();

            var status = await http.GetFromJsonAsync<JsonElement>($"{HttpUrl}/api/engine/https", bound.Token);

            status.GetProperty("listening").GetBoolean().Should().BeFalse();
            status.GetProperty("problem").GetString().Should().Contain("10214");
            passed = true;
        }
        finally
        {
            holder.Stop();
            await TestEngine.EnsureAsync(bound.Token);
            if (passed) TestEngine.TryDeleteHome(home);
        }
    }

    private static HttpClient NewTrustAllClient() => new(new HttpClientHandler
    {
        ServerCertificateCustomValidationCallback = (_, _, _, _) => true
    });
}
