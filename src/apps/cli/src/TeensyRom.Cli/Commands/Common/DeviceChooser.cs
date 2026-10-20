using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Helpers;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;

namespace TeensyRom.Cli.Commands.Common;

/// <summary>Which of the devices tr-web knows a command may work with.</summary>
internal enum DeviceScope
{
    /// <summary>Devices that are online now.</summary>
    Online,

    /// <summary>Every device tr-web knows, online or not.</summary>
    Known
}

/// <summary>
/// Picks the TeensyROM a command works with, without ever needing a terminal unless several qualify and nobody named one.
/// </summary>
internal interface IDeviceChooser
{
    /// <summary>
    /// Returns the device named by <paramref name="requested"/> (id, or name in any case), else the only candidate,
    /// else the one the user picks from a prompt on stderr.
    /// </summary>
    /// <exception cref="CliException">
    /// <see cref="CliExitCode.NotFound"/> when nothing matches <paramref name="requested"/>;
    /// <see cref="CliExitCode.NoDevice"/> when the match is offline under <see cref="DeviceScope.Online"/>, no device qualifies,
    /// or several do and no prompt is possible.
    /// </exception>
    Task<DeviceSummary> ChooseAsync(string? requested, DeviceScope scope, CancellationToken ct);
}

/// <inheritdoc cref="IDeviceChooser"/>
/// <remarks>
/// Makes one <c>GetDevicesAsync</c> call per choice. tr-web's <c>/api/devices</c> answers one request per 5 seconds
/// (a second waits in a queue of one, anything beyond is a 503), so back-to-back <c>trom</c> invocations can wait up to
/// about 5 seconds on it. That is expected, not a bug. Keep device lookups to one per invocation.
/// </remarks>
internal sealed class DeviceChooser(IDeviceService devices, ICliOutput output) : IDeviceChooser
{
    public async Task<DeviceSummary> ChooseAsync(string? requested, DeviceScope scope, CancellationToken ct)
    {
        var known = await devices.GetDevicesAsync(ct);
        var candidates = scope == DeviceScope.Online ? known.Where(d => d.IsOnline).ToList() : known.ToList();

        if (!string.IsNullOrWhiteSpace(requested)) return Requested(requested.Trim(), known, candidates, scope);

        switch (candidates.Count)
        {
            case 0:
                throw new CliException(CliExitCode.NoDevice, NoneMessage(scope));
            case 1:
                return candidates[0];
        }

        var labels = candidates.Select(Label).ToList();

        if (output.CanPrompt && Prompt(labels) is { } choice) return candidates[labels.IndexOf(choice)];

        throw new CliException(CliExitCode.NoDevice,
            $"Several TeensyROMs are available ({string.Join(", ", labels)}). Choose one with `--device <name>`.");
    }

    private static string NoneMessage(DeviceScope scope) => scope == DeviceScope.Online
        ? "No TeensyROM is online. Connect one, then run `trom device discover`."
        : "tr-web doesn't know any TeensyROM yet. Connect one, then run `trom device discover`.";

    private static DeviceSummary Requested(string requested, IReadOnlyList<DeviceSummary> known, List<DeviceSummary> candidates, DeviceScope scope)
    {
        var match = known.FirstOrDefault(d => d.Id == requested);

        if (match is null)
        {
            var named = known.Where(d => d.Name.Equals(requested, StringComparison.OrdinalIgnoreCase)).ToList();

            if (named.Count > 1)
            {
                throw new CliException(CliExitCode.Usage,
                    $"More than one TeensyROM is named '{requested}'. Choose one by id with `--device <id>`: {string.Join(", ", named.Select(d => d.Id))}.");
            }
            match = named.FirstOrDefault();
        }

        if (match is null)
        {
            throw new CliException(CliExitCode.NotFound, candidates.Count == 0
                ? $"No TeensyROM matches '{requested}'. {NoneMessage(scope)}"
                : $"No TeensyROM matches '{requested}'. Choose one of: {string.Join(", ", candidates.Select(d => d.Name))}.");
        }

        if (scope == DeviceScope.Online && !match.IsOnline)
        {
            throw new CliException(CliExitCode.NoDevice, $"{match.Name} is offline. Run `trom device reconnect --device {match.Name}`.");
        }
        return match;
    }

    /// <summary>The user's pick, or null when this terminal cannot show a prompt.</summary>
    private static string? Prompt(List<string> labels)
    {
        try
        {
            return PromptHelper.FilePrompt("TeensyROM", labels);
        }
        catch (NotSupportedException)
        {
            return null;
        }
    }

    private static string Label(DeviceSummary device) => $"{device.Name} ({device.Connection})";
}
