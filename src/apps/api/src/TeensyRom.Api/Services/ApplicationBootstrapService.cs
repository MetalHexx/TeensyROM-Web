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
    public class ApplicationBootstrapService : BackgroundService
    {
        private readonly IDeviceConnectionManager _deviceManager;
        private readonly ITransferStagingStore _stagingStore;
        private readonly ILoggingService _log;

        public ApplicationBootstrapService(
            ISettingsService settingsService,
            IDeviceConnectionManager deviceManager,
            ITransferStagingStore stagingStore,
            ILoggingService log)
        {
            _deviceManager = deviceManager;
            _stagingStore = stagingStore;
            _log = log;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Device discovery includes synchronous serial probes. Yielding before
            // that work lets Kestrel bind and makes the desktop shell responsive
            // while discovery continues in the background.
            await Task.Yield();

            _log.Internal("ApplicationBootstrap: Starting application bootstrap...");

            try
            {
                _stagingStore.SweepAll();

                await PerformDeviceAutoDiscovery(stoppingToken);


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

        public override Task StopAsync(CancellationToken cancellationToken)
        {
            _log.Internal("ApplicationBootstrap: Stopping...");
            return Task.CompletedTask;
        }

        /// <summary>
        /// Performs per-device auto-connect based on individual device settings.
        /// Discovers all devices first, then connects only those with autoConnectEnabled=true.
        /// New devices are automatically registered with default settings.
        /// </summary>
        private async Task PerformDeviceAutoDiscovery(CancellationToken cancellationToken)
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

                _log.Internal($"ApplicationBootstrap: Discovered {devices.Count} device(s).");
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
    }
}
