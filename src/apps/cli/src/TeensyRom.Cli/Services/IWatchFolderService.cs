using TeensyRom.Cli.Api.Generated;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Services;

/// <summary>
/// tr-web's watch folders: computer folders whose new files it sends to one or more TeensyROMs.
/// </summary>
/// <remarks>Every failure arrives as a <see cref="Api.TeensyApiException"/> carrying tr-web's own wording.</remarks>
internal interface IWatchFolderService
{
    Task<IReadOnlyList<WatchFolderDto>> ListAsync(CancellationToken ct);

    /// <summary>Watches <paramref name="folder"/> for <paramref name="deviceId"/>; <c>Created</c> is false when the folder was already watched and only gained a destination.</summary>
    /// <param name="devicePath">The folder on the TeensyROM the files land in; tr-web's default when null.</param>
    /// <param name="launch">Have the TeensyROM launch what arrives.</param>
    Task<AddWatchFolderResponse> AddAsync(string folder, string deviceId, TeensyStorageType storage, string? devicePath, bool launch, CancellationToken ct);

    /// <summary>Stops watching the folder altogether.</summary>
    Task RemoveAsync(string watchFolderId, CancellationToken ct);

    /// <summary>Removes the folder's destinations for one device; the folder goes with its last destination.</summary>
    Task<RemoveWatchFolderDeviceResponse> RemoveDeviceAsync(string watchFolderId, string deviceId, CancellationToken ct);

    /// <summary>Changes the folder and/or launch flag of the device's destination on the watch folder, in place; null leaves a value as it is.</summary>
    Task<WatchFolderDto> SetDeviceAsync(string watchFolderId, string deviceId, string? devicePath, bool? launch, CancellationToken ct);

    Task<WatchFolderDto> SetEnabledAsync(string watchFolderId, bool enabled, CancellationToken ct);

    /// <summary>
    /// Finds the watch folder at <paramref name="folder"/>, matching full paths: trailing separator trimmed, and ignoring
    /// case on Windows.
    /// </summary>
    /// <exception cref="Errors.CliException"><see cref="Errors.CliExitCode.NotFound"/> when nothing matches.</exception>
    Task<WatchFolderDto> FindAsync(string folder, CancellationToken ct);
}
