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
                // Settings are guaranteed to be loaded (singleton constructor ran during DI)
                var settings = _settingsService.GetSettings();

                // Execute startup operations in sequence
                await PerformDeviceAutoConnect(settings, cancellationToken);

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
        /// Performs device auto-connect if enabled in settings.
        /// Discovers and connects to all available TeensyROM devices on startup.
        /// </summary>
        private async Task PerformDeviceAutoConnect(TeensyRom.Core.Settings.TeensySettings settings, CancellationToken cancellationToken)
        {
            if (!settings.ConnectionSettings.AutoConnectEnabled)
            {
                _log.Internal("ApplicationBootstrap: Device auto-connect disabled - skipping");
                return;
            }

            _log.Internal("ApplicationBootstrap: Device auto-connect enabled - scanning for devices...");

            try
            {
                // Find all devices and auto-connect new ones
                var devices = await _deviceManager.FindDevices(autoConnect: true, cancellationToken);

                if (devices.Count > 0)
                {
                    _log.InternalSuccess($"ApplicationBootstrap: Successfully connected to {devices.Count} device(s)");
                }
                else
                {
                    _log.InternalWarning("ApplicationBootstrap: No TeensyROM devices found on startup");
                }
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
