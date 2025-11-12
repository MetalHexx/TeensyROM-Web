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
  DEVICE_EVENTS_SERVICE,
  DEVICE_LOGS_SERVICE,
  IAlertService,
  IDeviceEventsService,
  IDeviceLogsService,
} from '@teensyrom-nx/domain';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';

@Injectable({ providedIn: 'root' })
export class AppBootstrapService {
  private readonly settingsStore = inject(SettingsStore);
  private readonly deviceStore = inject(DeviceStore);
  private readonly deviceLogsService: IDeviceLogsService = inject(DEVICE_LOGS_SERVICE);
  private readonly deviceEventsService: IDeviceEventsService = inject(DEVICE_EVENTS_SERVICE);
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
      this.deviceEventsService.connect();
      this.deviceStore.findDevices();
    });
  }

  /**
   * Initialize settings by loading from backend
   * Settings load failure is non-critical - app continues with defaults
   */
  private async initializeSettings(): Promise<void> {
    logInfo(LogType.Start, 'AppBootstrap: Initializing settings...');

    // Trigger settings load
    this.settingsStore.loadSettings();

    // Wait for settings to finish loading
    await this.waitForSettingsInit();

    // Check if settings load failed
    const error = this.settingsStore.error();
    if (error) {
      logWarn(`AppBootstrap: Settings failed to load, using defaults: ${error}`);
      // App continues with defaults - non-blocking error
    } else {
      logInfo(LogType.Success, 'AppBootstrap: Settings loaded successfully');
    }
  }

  /**
   * Wait for settings initialization to complete
   * Uses effect pattern to watch isLoading signal
   */
  private async waitForSettingsInit(): Promise<void> {
    return new Promise((resolve) => {
      runInInjectionContext(this.injector, () => {
        const effectRef = effect(() => {
          const isLoading = this.settingsStore.isLoading();
          if (!isLoading) {
            // Use untracked to prevent the effect from re-running when we resolve
            untracked(() => {
              resolve();
            });
            // Clean up effect to prevent memory leaks
            effectRef.destroy();
          }
        });
      });
    });
  }
}
