using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;

namespace TeensyRom.Cli.Services;

internal sealed class DeviceService(ITeensyRomApiClient api) : IDeviceService
{
    public DeviceSummary? SelectedDevice { get; private set; }

    public Task<IReadOnlyList<DeviceSummary>> GetDevicesAsync(CancellationToken ct = default) => FindAsync(fullScan: false, ct);

    public async Task<IReadOnlyList<DeviceSummary>> FindAsync(bool fullScan, CancellationToken ct = default)
    {
        try
        {
            var response = await ApiErrors.Call(() => api.FindDevicesAsync(fullScan, ct));
            return response.Devices.Select(ToSummary).ToList();
        }
        catch (TeensyApiException ex) when (ex.StatusCode == 404)
        {
            return [];
        }
        catch (TeensyApiException ex) when (ex.StatusCode == 503)
        {
            throw new TeensyApiException("tr-web is busy listing devices — try again in a few seconds.", ex.StatusCode, ex);
        }
    }

    public void Select(DeviceSummary device) => SelectedDevice = device;

    public string RequireDeviceId() =>
        SelectedDevice?.Id ?? throw new TeensyApiException("No TeensyROM is selected.");

    public async Task ToggleMusicAsync()
    {
        var deviceId = RequireDeviceId();
        await ApiErrors.Call(() => api.ToggleMusicAsync(deviceId));
    }

    public async Task ResetAsync()
    {
        var deviceId = RequireDeviceId();
        await ApiErrors.Call(() => api.ResetDeviceAsync(deviceId));
    }

    private static DeviceSummary ToSummary(CartDto cart) => new(
        cart.DeviceId,
        cart.Name,
        cart.DeviceState != DeviceState.ConnectionLost,
        cart.ConnectionType == ConnectionType.Serial ? $"USB {cart.ComPort}" : $"Ethernet {cart.IpAddress}",
        cart.DeviceState.ToString(),
        cart.SdStorage.Available,
        cart.UsbStorage.Available);
}
