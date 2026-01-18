import {
  effect,
  inject,
  Injectable,
  runInInjectionContext,
  Injector,
  untracked,
} from '@angular/core';
import { DeviceStore, SettingsStore } from '@teensyrom-nx/application';
import {
  ALERT_SERVICE,
  DEVICE_LOGS_SERVICE,
  IAlertService,
  IDeviceLogsService,
} from '@teensyrom-nx/domain';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';

@Injectable({ providedIn: 'root' })
export class AppBootstrapService {
  private readonly settingsStore = inject(SettingsStore);
  private readonly deviceStore = inject(DeviceStore);
  private readonly deviceLogsService: IDeviceLogsService = inject(DEVICE_LOGS_SERVICE);
  private readonly injector = inject(Injector);
  private readonly alertService: IAlertService = inject(ALERT_SERVICE);

  async init(): Promise<void> {
    logInfo(LogType.Start, 'AppBootstrap: Application bootstrap started');

    // Initialize settings first (loads from backend)
    await this.initializeSettings();

    // Initialize device discovery
    return new Promise((resolve) => {
      runInInjectionContext(this.injector, () => {
        const effectRef = effect(() => {
          if (this.deviceStore.hasInitialised()) {
            // Use untracked to prevent the effect from re-running when we resolve
            untracked(() => {
              logInfo(LogType.Success, 'AppBootstrap: Application bootstrap complete');
              resolve();
            });
            // Destroy the effect immediately to prevent re-runs
            effectRef.destroy();
          }
        });
      });
      this.deviceLogsService.connect();
      // Quick scan on bootstrap - don't do full network scan
      this.deviceStore.findDevices(false);
    });
  }

  /**
   * Initialize settings by loading from backend
   * Bootstrap will block until settings are loaded or loading fails
   */
  private async initializeSettings(): Promise<void> {
    logInfo(LogType.Start, 'AppBootstrap: Initializing settings...');

    // Trigger settings load
    this.settingsStore.loadSettings();

    // Wait for settings to finish loading and be available
    await this.waitForSettingsInit();

    // Check if settings load failed after waiting
    const error = this.settingsStore.error();
    if (error) {
      logWarn(`AppBootstrap: Settings failed to load, using defaults: ${error}`);
      // App continues with defaults - non-blocking error
    }
  }

  /**
   * Wait for settings initialization to complete
   * Uses effect pattern to watch isLoading signal and settings availability
   * Blocks until settings are actually loaded, not just done loading
   */
  private async waitForSettingsInit(): Promise<void> {
    return new Promise((resolve) => {
      runInInjectionContext(this.injector, () => {
        const effectRef = effect(() => {
          const isLoading = this.settingsStore.isLoading();
          const settings = this.settingsStore.settings();
          
          // Wait until not loading AND settings exist
          if (!isLoading && settings !== null) {
            logInfo(LogType.Success, 'AppBootstrap: Settings loaded and available');
            // Use untracked to prevent the effect from re-running when we resolve
            untracked(() => {
              resolve();
            });
            // Clean up effect to prevent memory leaks
            effectRef.destroy();
          } else if (!isLoading && settings === null) {
            // Loading finished but no settings - still resolve to unblock
            logWarn('AppBootstrap: Settings load completed but settings are null, continuing with defaults');
            untracked(() => {
              resolve();
            });
            effectRef.destroy();
          }
        });
      });
    });
  }
}
