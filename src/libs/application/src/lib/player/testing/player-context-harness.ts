import { TestBed } from '@angular/core/testing';
import { EMPTY, Observable, of } from 'rxjs';
import { vi } from 'vitest';
import {
  ALERT_SERVICE,
  DEVICE_SERVICE,
  DirectoryItem,
  FileItem,
  IAlertService,
  IDeviceService,
  IPlayerService,
  ISettingsService,
  IStorageService,
  PLAYER_INCOMPATIBLE_RETRY_DELAY_MS,
  PLAYER_LAUNCH_DELAY_MS,
  PLAYER_SERVICE,
  PLAYER_TIMER_TICK_MS,
  SETTINGS_SERVICE,
  STORAGE_SERVICE,
  Settings,
  StorageDirectory,
  StorageType,
} from '@teensyrom-nx/domain';
import {
  createMockAlertService,
  createMockDeviceService,
  createMockPlayerService,
  createMockStorageService,
  createTestStorageDirectory,
} from '@teensyrom-nx/testing/fixtures';
import { PlayerContextService } from '../player-context.service';
import { PlayerStore } from '../player-store';
import { PlayerTimerManager } from '../player-timer-manager';
import { IPlayerStorage, PLAYER_STORAGE } from '../player-storage.interface';
import { SettingsStore } from '../../settings/settings-store';
import { StorageStore } from '../../storage/storage-store';

type PlayerStoreInstance = InstanceType<typeof PlayerStore>;
type StorageStoreInstance = InstanceType<typeof StorageStore>;
type SettingsStoreInstance = InstanceType<typeof SettingsStore>;

/** Directory contents to stage for a device, consumed by {@link PlayerHarness.arrangeDirectory}. */
export interface ArrangeDirectoryOptions {
  deviceId: string;
  /** Directory to select; `/` stages the storage root. */
  path: string;
  files?: FileItem[];
  /** Defaults to `StorageType.Sd`. */
  storageType?: StorageType;
  /** Child directories listed inside `path`. */
  directories?: DirectoryItem[];
}

/** Infrastructure-boundary mocks a spec can replace when the default behavior is not enough. */
export interface PlayerHarnessServiceOverrides {
  player?: Partial<IPlayerService>;
  storage?: Partial<IStorageService>;
  device?: Partial<IDeviceService>;
  alert?: Partial<IAlertService>;
}

export interface PlayerHarnessOptions {
  launchDelayMs?: number;
  incompatibleRetryDelayMs?: number;
  timerTickMs?: number;
  services?: PlayerHarnessServiceOverrides;
}

/**
 * Handles onto one configured TestBed: the real application layer plus the mocks
 * standing in for infrastructure. Arrange through the stores' own actions —
 * the stores are real, so stubbing their selectors defeats the point of the harness.
 */
export interface PlayerHarness {
  service: PlayerContextService;
  playerStore: PlayerStoreInstance;
  storageStore: StorageStoreInstance;
  settingsStore: SettingsStoreInstance;
  playerService: Partial<IPlayerService>;
  storageService: Partial<IStorageService>;
  deviceService: Partial<IDeviceService>;
  alertService: Partial<IAlertService>;
  /**
   * Stages a directory listing and drives the real `StorageStore` to select it,
   * leaving the device initialized with `path` as its selected directory.
   *
   * Only effective with the harness's own `getDirectory` mock — a spec that overrides
   * `services.storage.getDirectory` owns its directory responses instead.
   */
  arrangeDirectory(options: ArrangeDirectoryOptions): Promise<void>;
}

/**
 * Builds the application-layer player TestBed: real `PlayerContextService`, `PlayerStore`,
 * `StorageStore`, `SettingsStore` and `PlayerTimerManager`, with mocks only at the
 * infrastructure boundary (the domain service tokens) and at `PLAYER_STORAGE`, whose
 * localStorage-backed implementation would otherwise leak state between tests.
 *
 * All timing tokens default to `0` so no spec waits on a real delay.
 */
export function createPlayerHarness(options: PlayerHarnessOptions = {}): PlayerHarness {
  const {
    launchDelayMs = 0,
    incompatibleRetryDelayMs = 0,
    timerTickMs = 0,
    services = {},
  } = options;

  const stagedDirectories = new Map<string, StorageDirectory>();
  const directoryKey = (deviceId: string, storageType: StorageType, path: string) =>
    `${deviceId}|${storageType}|${path}`;

  const playerService = createMockPlayerService({
    launchFile: vi.fn((_deviceId: string, file: FileItem) => of(file)),
    ...services.player,
  });

  const storageService = createMockStorageService({
    getDirectory: vi.fn((deviceId: string, storageType: StorageType, path = '/') =>
      of(
        stagedDirectories.get(directoryKey(deviceId, storageType, path)) ??
          createTestStorageDirectory({ path })
      )
    ),
    ...services.storage,
  });

  const deviceService = createMockDeviceService({ ...services.device });
  const alertService = createMockAlertService({ ...services.alert });

  const playerStorage: IPlayerStorage = {
    load: vi.fn().mockReturnValue(null),
    save: vi.fn(),
    hasSavedState: vi.fn().mockReturnValue(false),
    clear: vi.fn(),
  };

  // SettingsStore resolves this token eagerly; specs arrange settings through the store's
  // own `updateSettings` action rather than through a backend response.
  const settingsService: ISettingsService = {
    getSettings: vi.fn<() => Observable<Settings>>(() => EMPTY),
    saveSettings: vi.fn((settings: Settings) => of(settings)),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      PlayerContextService,
      PlayerStore,
      StorageStore,
      SettingsStore,
      PlayerTimerManager,
      { provide: PLAYER_SERVICE, useValue: playerService },
      { provide: STORAGE_SERVICE, useValue: storageService },
      { provide: DEVICE_SERVICE, useValue: deviceService },
      { provide: ALERT_SERVICE, useValue: alertService },
      { provide: SETTINGS_SERVICE, useValue: settingsService },
      { provide: PLAYER_STORAGE, useValue: playerStorage },
      { provide: PLAYER_LAUNCH_DELAY_MS, useValue: launchDelayMs },
      { provide: PLAYER_INCOMPATIBLE_RETRY_DELAY_MS, useValue: incompatibleRetryDelayMs },
      { provide: PLAYER_TIMER_TICK_MS, useValue: timerTickMs },
    ],
  });

  const storageStore = TestBed.inject(StorageStore);

  const arrangeDirectory = async ({
    deviceId,
    path,
    files = [],
    storageType = StorageType.Sd,
    directories = [],
  }: ArrangeDirectoryOptions): Promise<void> => {
    stagedDirectories.set(
      directoryKey(deviceId, storageType, path),
      createTestStorageDirectory({ path, files, directories })
    );

    await storageStore.initializeStorage({ deviceId, storageType });

    if (path !== '/') {
      await storageStore.navigateToDirectory({ deviceId, storageType, path });
    }
  };

  return {
    service: TestBed.inject(PlayerContextService),
    playerStore: TestBed.inject(PlayerStore),
    storageStore,
    settingsStore: TestBed.inject(SettingsStore),
    playerService,
    storageService,
    deviceService,
    alertService,
    arrangeDirectory,
  };
}
