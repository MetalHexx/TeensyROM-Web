using TeensyRom.Cli.Api;

namespace TeensyRom.Cli.Services;

/// <summary>
/// tr-web's live log for the selected device. It is the only place tr-web reports what it is doing while it works,
/// indexing for one.
/// </summary>
internal interface IDeviceLogStream
{
    /// <summary>
    /// Subscribes to tr-web's log and hands <paramref name="onLine"/> every line it logs for the selected device, as
    /// it is logged and without the device and level prefix. Disposing the returned handle unsubscribes.
    /// </summary>
    /// <remarks><paramref name="onLine"/> runs on a background thread.</remarks>
    /// <exception cref="TeensyApiException">No device is selected, or tr-web wouldn't let this CLI follow its log.</exception>
    Task<IAsyncDisposable> FollowAsync(Action<string> onLine, CancellationToken ct = default);

    /// <summary>
    /// Like <see cref="FollowAsync"/> but for every device: <paramref name="onLine"/> gets the device id and the
    /// message of each line tr-web logs for any device. Needs no selected device.
    /// </summary>
    /// <remarks><paramref name="onLine"/> runs on a background thread.</remarks>
    /// <exception cref="TeensyApiException">tr-web wouldn't let this CLI follow its log.</exception>
    Task<IAsyncDisposable> FollowEveryDeviceAsync(Action<string, string> onLine, CancellationToken ct = default);
}
