using System.Reactive.Linq;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Common;
using TeensyRom.Core.Settings;
using TeensyRom.Core.ValueObjects;

namespace TeensyRom.Api.WatchFolders
{
    /// <inheritdoc cref="IWatchFolderStore"/>
    public sealed class WatchFolderStore(ISettingsService settings, IDeviceConnectionManager devices) : IWatchFolderStore
    {
        private const string DefaultDevicePath = "/auto-transfer";

        public IObservable<IReadOnlyList<WatchFolder>> Changed { get; } = settings.Settings
            .Select(s => s.WatchFolders)
            .DistinctUntilChanged()
            .Select(list => list.AsReadOnly());

        public IReadOnlyList<WatchFolder> GetAll() => settings.GetSettings().WatchFolders.AsReadOnly();

        public WatchFolder? Get(string watchFolderId) =>
            settings.GetSettings().WatchFolders.FirstOrDefault(f => f.Id == watchFolderId);

        public WatchFolderAddResult Add(WatchFolderAdd request)
        {
            string folderPath;
            try
            {
                folderPath = WatchFolderPaths.Normalize(request.FolderPath);
            }
            catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
            {
                return Failed(WatchFolderAddError.FolderNotFound, $"'{request.FolderPath}' is not a valid folder path.");
            }

            if (!Directory.Exists(folderPath))
            {
                return Failed(WatchFolderAddError.FolderNotFound, $"The folder '{folderPath}' was not found on this machine.");
            }

            if (!TryParseDevicePath(request.DevicePath, out var devicePath))
            {
                return Failed(WatchFolderAddError.InvalidDevicePath,
                    "The device path must be a valid Unix-style directory path without '.' or '..' segments.");
            }

            var device = devices.GetAvailableDevice(request.DeviceId);
            if (device is null)
            {
                return Failed(WatchFolderAddError.DeviceNotFound, $"No connected device was found with id {request.DeviceId}.");
            }

            if (StandInDeviceId.IsStandIn(request.DeviceId))
            {
                return Failed(WatchFolderAddError.StandInDevice,
                    "This device did not report its chip id, so a watch folder cannot follow it.");
            }

            if (device.GetStorage(request.StorageType) is null)
            {
                return Failed(WatchFolderAddError.StorageUnavailable,
                    $"The storage {request.StorageType} is not available.");
            }

            var destination = new WatchFolderDestination
            {
                Id = NewId(),
                DeviceId = request.DeviceId,
                StorageType = request.StorageType,
                Path = devicePath,
                Launch = request.Launch
            };

            WatchFolderAddResult? outcome = null;
            var saved = settings.UpdateSettings(latest =>
            {
                var existing = latest.WatchFolders.FirstOrDefault(f => WatchFolderPaths.AreSame(f.Path, folderPath));
                if (existing is not null)
                {
                    if (existing.Destinations.Any(d => d.DeviceId == request.DeviceId))
                    {
                        outcome = Failed(WatchFolderAddError.DeviceAlreadyOnFolder,
                            "This device already receives this folder. Change that destination instead of adding it again.");
                        return latest;
                    }

                    var extended = existing with { Destinations = [.. existing.Destinations, destination] };
                    outcome = new WatchFolderAddResult(extended, Created: false, null, null);
                    return latest with { WatchFolders = [.. latest.WatchFolders.Select(f => ReferenceEquals(f, existing) ? extended : f)] };
                }

                if (latest.WatchFolders.Any(f => WatchFolderPaths.IsNestedIn(f.Path, folderPath) || WatchFolderPaths.IsNestedIn(folderPath, f.Path)))
                {
                    outcome = Failed(WatchFolderAddError.Nested,
                        "This folder overlaps a folder that is already watched. Folders cannot be nested in one another.");
                    return latest;
                }

                var created = new WatchFolder { Id = NewId(), Path = folderPath, Enabled = true, Destinations = [destination] };
                outcome = new WatchFolderAddResult(created, Created: true, null, null);
                return latest with { WatchFolders = [.. latest.WatchFolders, created] };
            });

            return ConfirmSaved(saved, outcome!);
        }

        public bool RemoveFolder(string watchFolderId)
        {
            var found = false;
            var saved = settings.UpdateSettings(latest =>
            {
                if (!latest.WatchFolders.Any(f => f.Id == watchFolderId)) return latest;

                found = true;
                return latest with { WatchFolders = [.. latest.WatchFolders.Where(f => f.Id != watchFolderId)] };
            });

            return ConfirmSaved(saved, found);
        }

        public WatchFolderRemoveDeviceResult RemoveDevice(string watchFolderId, string deviceId)
        {
            var outcome = new WatchFolderRemoveDeviceResult(Found: false, FolderRemoved: false, null);
            var saved = settings.UpdateSettings(latest =>
            {
                var folder = latest.WatchFolders.FirstOrDefault(f => f.Id == watchFolderId);
                if (folder is null || !folder.Destinations.Any(d => d.DeviceId == deviceId)) return latest;

                var remaining = folder.Destinations.Where(d => d.DeviceId != deviceId).ToList();
                if (remaining.Count == 0)
                {
                    outcome = new WatchFolderRemoveDeviceResult(Found: true, FolderRemoved: true, null);
                    return latest with { WatchFolders = [.. latest.WatchFolders.Where(f => f.Id != watchFolderId)] };
                }

                var updated = folder with { Destinations = remaining };
                outcome = new WatchFolderRemoveDeviceResult(Found: true, FolderRemoved: false, updated);
                return latest with { WatchFolders = [.. latest.WatchFolders.Select(f => ReferenceEquals(f, folder) ? updated : f)] };
            });

            return ConfirmSaved(saved, outcome);
        }

        public WatchFolderSetDestinationResult SetDestination(string watchFolderId, string deviceId, string? devicePath, bool? launch)
        {
            if (devicePath is null && launch is null)
            {
                return SetFailed(WatchFolderSetDestinationError.NothingToChange, "Give a device path or a launch value to change.");
            }

            var parsedPath = string.Empty;
            if (devicePath is not null && (string.IsNullOrWhiteSpace(devicePath) || !TryParseDevicePath(devicePath, out parsedPath)))
            {
                return SetFailed(WatchFolderSetDestinationError.InvalidDevicePath,
                    "The device path must be a valid Unix-style directory path without '.' or '..' segments.");
            }

            WatchFolderSetDestinationResult? outcome = null;
            var saved = settings.UpdateSettings(latest =>
            {
                var folder = latest.WatchFolders.FirstOrDefault(f => f.Id == watchFolderId);
                var destination = folder?.Destinations.FirstOrDefault(d => d.DeviceId == deviceId);
                if (folder is null || destination is null)
                {
                    outcome = SetFailed(WatchFolderSetDestinationError.NotFound,
                        $"Watch folder {watchFolderId} has no destination for device {deviceId}.");
                    return latest;
                }

                var changed = destination with
                {
                    Path = devicePath is null ? destination.Path : parsedPath,
                    Launch = launch ?? destination.Launch
                };
                if (changed == destination)
                {
                    outcome = new WatchFolderSetDestinationResult(folder, null, null);
                    return latest;
                }

                var updated = folder with { Destinations = [.. folder.Destinations.Select(d => ReferenceEquals(d, destination) ? changed : d)] };
                outcome = new WatchFolderSetDestinationResult(updated, null, null);
                return latest with { WatchFolders = [.. latest.WatchFolders.Select(f => ReferenceEquals(f, folder) ? updated : f)] };
            });

            return ConfirmSaved(saved, outcome!);
        }

        public WatchFolder? SetEnabled(string watchFolderId, bool enabled)
        {
            WatchFolder? result = null;
            var saved = settings.UpdateSettings(latest =>
            {
                var folder = latest.WatchFolders.FirstOrDefault(f => f.Id == watchFolderId);
                if (folder is null) return latest;

                if (folder.Enabled == enabled)
                {
                    result = folder;
                    return latest;
                }

                var updated = folder with { Enabled = enabled };
                result = updated;
                return latest with { WatchFolders = [.. latest.WatchFolders.Select(f => ReferenceEquals(f, folder) ? updated : f)] };
            });

            return ConfirmSaved(saved, result);
        }

        private static bool TryParseDevicePath(string? requested, out string devicePath)
        {
            devicePath = string.Empty;
            try
            {
                var parsed = new DirectoryPath(string.IsNullOrWhiteSpace(requested) ? DefaultDevicePath : requested);
                if (parsed.Value.Split('/', StringSplitOptions.RemoveEmptyEntries).Any(s => s is "." or "..")) return false;

                devicePath = parsed.Value;
                return true;
            }
            catch (ArgumentException)
            {
                return false;
            }
        }

        private static WatchFolderAddResult Failed(WatchFolderAddError error, string message) =>
            new(null, Created: false, error, message);

        private static WatchFolderSetDestinationResult SetFailed(WatchFolderSetDestinationError error, string message) =>
            new(null, error, message);

        private static string NewId() => Guid.NewGuid().ToString("N");

        private static T ConfirmSaved<T>(bool saved, T result) =>
            saved ? result : throw new IOException("Failed to save the watch folder settings.");
    }
}
