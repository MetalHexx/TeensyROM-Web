// Runs the real CLI in-process against the one shared engine (TestEngine) - no hardware needed.
//
//   dotnet test src/apps/cli/src/TeensyRom.Cli.Tests.Integration --filter "Category!=Hardware"
//
// The fixture starts or reuses the engine through the CLI's own source-mode start path, built from this repository,
// in a throwaway home; it never touches the real ~/.teensyrom.

using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// Ensures the shared engine once per run and reads its device list once, so scenarios never
/// race the <c>/api/devices</c> rate limit (one request per 5 s, one queued).
/// </summary>
public sealed class SharedApiFixture : IAsyncLifetime
{
    private HttpClient? _http;

    /// <summary>A direct client for cross-checking what the CLI shows against what the API reports.</summary>
    public ITeensyRomApiClient Api { get; private set; } = null!;

    /// <summary>Every device the API knew when the run started, read once.</summary>
    public IReadOnlyList<CartDto> Devices { get; private set; } = [];

    public IReadOnlyList<CartDto> OnlineDevices => Devices.Where(d => d.DeviceState != DeviceState.ConnectionLost).ToList();

    public async Task InitializeAsync()
    {
        using (var timeout = TestEngine.Bounded())
        {
            await TestEngine.EnsureAsync(timeout.Token);
        }

        _http = new HttpClient { BaseAddress = new Uri(EngineAddress.BaseUrl) };
        Api = new TeensyRomApiClient(_http);
        Devices = await ReadDevicesAsync();
    }

    public Task DisposeAsync()
    {
        _http?.Dispose();
        return Task.CompletedTask;
    }

    private async Task<IReadOnlyList<CartDto>> ReadDevicesAsync()
    {
        try
        {
            var response = await Api.FindDevicesAsync(fullScan: false);
            return response.Devices.ToList();
        }
        catch (ApiException ex) when (ex.StatusCode == 404)
        {
            return [];
        }
    }
}
