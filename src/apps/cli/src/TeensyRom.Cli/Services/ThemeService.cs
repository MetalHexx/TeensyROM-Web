using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Themes;

namespace TeensyRom.Cli.Services;

internal sealed class ThemeService(ITeensyRomApiClient api) : IThemeService
{
    public async Task<IReadOnlyList<ThemeDto>> ListAsync(CancellationToken ct) =>
        (await ApiErrors.Call(() => api.ListThemesAsync(ct))).Themes.ToList();

    public async Task<ThemeDto> FindAsync(string nameOrId, CancellationToken ct)
    {
        var themes = await ListAsync(ct);

        if (themes.FirstOrDefault(theme => theme.Id == nameOrId) is { } byId) return byId;

        var wanted = nameOrId.Trim();
        var named = themes.Where(theme => theme.Name.Trim().Equals(wanted, StringComparison.OrdinalIgnoreCase)).ToList();

        return named.Count switch
        {
            0 => throw new CliException(CliExitCode.NotFound, $"No theme matches '{nameOrId}'."),
            1 => named[0],
            _ => throw new CliException(CliExitCode.Usage,
                $"More than one theme is named '{nameOrId}'. Choose one by id: {string.Join(", ", named.Select(theme => theme.Id))}.")
        };
    }

    public async Task<DeviceThemeRecordDto> GetDeviceRecordAsync(string deviceId, CancellationToken ct) =>
        (await ApiErrors.Call(() => api.GetDeviceThemeAsync(deviceId, ct))).Record;

    public async Task<IReadOnlyList<ThemeApplyOutcome>> ApplyAsync(IReadOnlyList<DeviceSummary> devices, ThemeApplyRequest request, CancellationToken ct)
    {
        var outcomes = new List<ThemeApplyOutcome>(devices.Count);

        foreach (var device in devices)
        {
            outcomes.Add(await ApplyToAsync(device, request, ct));
        }
        return outcomes;
    }

    public async Task<ThemeDto> CreateAsync(string name, ThemeColors colors, CancellationToken ct) =>
        (await ApiErrors.Call(() => api.CreateThemeAsync(new SaveThemeBody { Name = name, Device = colors.ToDto() }, ct))).Theme;

    public async Task<ThemeDto> UpdateAsync(string themeId, string name, ThemeColors colors, CancellationToken ct) =>
        (await ApiErrors.Call(() => api.UpdateThemeAsync(themeId, new SaveThemeBody { Name = name, Device = colors.ToDto() }, ct))).Theme;

    public async Task DeleteAsync(string themeId, CancellationToken ct) =>
        await ApiErrors.Call(() => api.DeleteThemeAsync(themeId, ct));

    private async Task<ThemeApplyOutcome> ApplyToAsync(DeviceSummary device, ThemeApplyRequest request, CancellationToken ct)
    {
        ThemeColors? sent = null;

        try
        {
            var themeId = request.ThemeId;
            var baseColors = request.Colors;

            if (baseColors is null)
            {
                var record = await GetDeviceRecordAsync(device.Id, ct);

                baseColors = ThemeColors.From(record.Colors);
                themeId ??= record.ThemeId;
            }
            sent = baseColors.With(request.Overrides);

            var body = new ApplyDeviceThemeBody { Colors = sent.ToDto(), ThemeId = themeId };
            var applied = await ApiErrors.Call(() => api.ApplyDeviceThemeAsync(device.Id, body, ct));

            return new ThemeApplyOutcome(device, ThemeApplyStatus.Applied, sent, applied.Record.IsRecorded, null);
        }
        catch (TeensyApiException failure)
        {
            return new ThemeApplyOutcome(device, failure.IsDeviceBusy ? ThemeApplyStatus.Busy : ThemeApplyStatus.Failed, sent, false, failure.Message);
        }
    }
}
