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
        private readonly ILoggingService _log;

        public ApplicationBootstrapService(
            ISettingsService settingsService,
            IDeviceConnectionManager deviceManager,
            ILoggingService log)
        {
            _settingsService = settingsService;
            _deviceManager = deviceManager;
            _log = log;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            _log.Internal("ApplicationBootstrap: Starting application bootstrap...");

            try
            {
                // Execute startup operations in sequence
                await PerformDeviceAutoConnect(cancellationToken);

                // Add additional startup operations here...
                // await InitializeOtherServices(settings, cancellationToken);

                _log.Internal("ApplicationBootstrap: Bootstrap complete");
            }
            catch (OperationCanceledException)
            {
                _log.InternalWarning("ApplicationBootstrap: Bootstrap cancelled during startup");
            }
            catch (Exception ex)
            {
                _log.ExternalError($"ApplicationBootstrap: Bootstrap failed: {ex.Message}");
                // Non-critical: App continues even if bootstrap fails
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
        /// </summary>
        private async Task PerformDeviceAutoConnect(CancellationToken cancellationToken)
        {
            _log.Internal("ApplicationBootstrap: Scanning for devices...");

            try
            {
                // 1. Discover all devices (don't auto-connect yet)
                var devices = await _deviceManager.FindDevices(autoConnect: false, cancellationToken);

                if (devices.Count == 0)
                {
                    _log.InternalWarning("ApplicationBootstrap: No TeensyROM devices found on startup");
                    return;
                }

                _log.Internal($"ApplicationBootstrap: Found {devices.Count} device(s), checking per-device settings...");

                int connectedCount = 0;
                int skippedCount = 0;

                foreach (var device in devices)
                {
                    // 2. Get or create device settings (creates with defaults if new)
                    var deviceSettings = _settingsService.GetOrCreateDeviceSettings(device.DeviceId);

                    // 3. Auto-connect only if enabled for this device
                    if (deviceSettings.ConnectionSettings.AutoConnectEnabled)
                    {
                        _deviceManager.Connect(device.DeviceId);
                        _log.InternalSuccess($"ApplicationBootstrap: Auto-connected device: {device.DeviceId}");
                        connectedCount++;
                    }
                    else
                    {
                        _log.Internal($"ApplicationBootstrap: Skipped auto-connect for device: {device.DeviceId} (disabled in settings)");
                        skippedCount++;
                    }
                }

                _log.InternalSuccess($"ApplicationBootstrap: Connected {connectedCount} device(s), skipped {skippedCount}");
            }
            catch (OperationCanceledException)
            {
                throw; // Re-throw cancellation to parent handler
            }
            catch (Exception ex)
            {
                _log.InternalError($"ApplicationBootstrap: Device auto-connect failed: {ex.Message}");
                // Non-critical: Continue bootstrap even if auto-connect fails
            }
        }
    }
}
