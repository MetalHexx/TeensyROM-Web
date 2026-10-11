using TeensyRom.Api.Transfers;
using TeensyRom.Core.Abstractions;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Settings;

namespace TeensyRom.Api.Services
{
    /// <summary>
    /// Background service that orchestrates application startup operations.
    /// Executes after DI container is built but before API accepts requests.
    /// Add additional startup operations here as needed.
    /// </summary>
    public class ApplicationBootstrapService : IHostedService
    {
        private readonly ISettingsService _settingsService;
        private readonly IDeviceConnectionManager _deviceManager;
        private readonly ITransferStagingStore _stagingStore;
        private readonly ITransferScratchStore _scratchStore;
        private readonly ILoggingService _log;

        public ApplicationBootstrapService(
            ISettingsService settingsService,
            IDeviceConnectionManager deviceManager,
            ITransferStagingStore stagingStore,
            ITransferScratchStore scratchStore,
            ILoggingService log)
        {
            _settingsService = settingsService;
            _deviceManager = deviceManager;
            _stagingStore = stagingStore;
            _scratchStore = scratchStore;
            _log = log;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            _log.Internal("ApplicationBootstrap: Starting application bootstrap...");

            try
            {
                _stagingStore.SweepAll();
                _scratchStore.SweepAll();

                await PerformDeviceAutoDiscovery(cancellationToken);


                _log.Internal("ApplicationBootstrap: Bootstrap complete");
            }
            catch (OperationCanceledException)
            {
                _log.InternalWarning("ApplicationBootstrap: Bootstrap cancelled during startup");
            }
            catch (Exception ex)
            {
                _log.ExternalError($"ApplicationBootstrap: Bootstrap failed: {ex.Message}");
            }
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            _log.Internal("ApplicationBootstrap: Stopping...");
            return Task.CompletedTask;
        }

        /// <summary>
        /// Performs per-device auto-connect based on individual device settings.
        /// Discovers all devices first, then connects only those with autoConnectEnabled=true.
        /// New devices are automatically registered with default settings.
        /// Afterwards, settings entries with no connection record are removed.
        /// </summary>
        private async Task PerformDeviceAutoDiscovery(CancellationToken cancellationToken)
        {
            _log.Internal("ApplicationBootstrap: Scanning for devices...");

            try
            {
                // 1. Confirm cached devices by chip id, falling back to a full discovery sweep
                var devices = await _deviceManager.ConnectAtStartAsync(cancellationToken);

                if (devices.Count == 0)
                {
                    _log.InternalWarning("ApplicationBootstrap: No TeensyROM devices found on startup");
                }
                else
                {
                    _log.Internal($"ApplicationBootstrap: Discovered {devices.Count} device(s).");
                }

                RemoveOrphanedSettings();
            }
            catch (OperationCanceledException)
            {
                throw; // Re-throw cancellation to parent handler
            }
            catch (Exception ex)
            {
                _log.InternalError($"ApplicationBootstrap: Device discovery failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Removes Settings.json device entries that no connection record backs. Offline units still count as known.
        /// A start that began with no saved records (fresh install, deleted record file) removes nothing, even when
        /// its discovery then found units: the records it ends with are its own, not the record of what was known before.
        /// </summary>
        private void RemoveOrphanedSettings()
        {
            if (!_deviceManager.StartedFromSavedRecords)
            {
                _log.Internal("ApplicationBootstrap: Orphan cleanup skipped - start began with no saved connection records");
                return;
            }

            var knownIds = SettingsOrphans.KnownIds(
                _deviceManager.GetAvailableDevices().Select(d => d.DeviceId)
                    .Concat(_deviceManager.GetOfflineDevices().Select(d => d.ChipId)));

            if (knownIds.Count == 0)
            {
                _log.Internal("ApplicationBootstrap: Orphan cleanup skipped - no connection records");
                return;
            }

            var settingsIds = _settingsService.GetSettings().KnownDevices.Select(d => d.DeviceId);

            foreach (var id in SettingsOrphans.Find(settingsIds, knownIds))
            {
                if (_settingsService.RemoveDeviceSettings(id))
                {
                    _log.Internal($"ApplicationBootstrap: Removed orphaned settings for {id}");
                }
            }
        }
    }
}
