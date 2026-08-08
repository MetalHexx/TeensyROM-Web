import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, convertToParamMap } from '@angular/router';
import {
  StorageStore,
  PlayerContextService,
  DeviceStore,
  PLAYER_STORAGE,
  SettingsStore,
  PlayerStore,
} from '@teensyrom-nx/application';
import {
  StorageType,
  DeviceState,
  Device,
  Settings,
  PlayerFilterType,
  FileItem,
  FileItemType,
} from '@teensyrom-nx/domain';
import { playerRouteResolver } from './player-route.resolver';

describe('playerRouteResolver', () => {
  let mockStorageStore: {
    initializeStorage: ReturnType<typeof vi.fn>;
    navigateToDirectory: ReturnType<typeof vi.fn>;
    getSelectedDirectoryForDevice: ReturnType<typeof vi.fn>;
    getSelectedDirectoryState: ReturnType<typeof vi.fn>;
  };
  let mockDeviceStore: {
    hasInitialised: ReturnType<typeof vi.fn>;
    devices: ReturnType<typeof vi.fn>;
  };
  let mockPlayerContextService: {
    startListeningToPopState: ReturnType<typeof vi.fn>;
    launchRandomFile: ReturnType<typeof vi.fn>;
    setFilterMode: ReturnType<typeof vi.fn>;
    launchFileWithContext: ReturnType<typeof vi.fn>;
  };
  let mockPlayerStorage: {
    load: ReturnType<typeof vi.fn>;
  };
  let mockPlayerStore: {
    getCurrentFile: ReturnType<typeof vi.fn>;
  };
  let mockSettingsStore: {
    getSettings: ReturnType<typeof vi.fn>;
  };

  const deviceId = 'device-1';

  const createMockDevice = (overrides: Partial<Device> = {}): Device => ({
    deviceId,
    comPort: 'COM3',
    name: 'Test Device',
    fwVersion: '1.0.0',
    isCompatible: true,
    isConnected: true,
    deviceState: DeviceState.Connected,
    isEnabled: true,
    sdStorage: { deviceId, type: StorageType.Sd, available: true, indexExists: true },
    usbStorage: { deviceId, type: StorageType.Usb, available: false, indexExists: false },
    ...overrides,
  });

  const createMockSettings = (overrides: Partial<Settings> = {}): Settings => ({
    playerSettings: {
      repeatModeOnStartup: false,
      playTimerEnabled: false,
      muteFastForward: false,
      muteRandomSeek: false,
      startupFilter: PlayerFilterType.All,
      startupLaunchEnabled: false,
      startupLaunchRandom: false,
    },
    fileTransferSettings: {
      watchDirectoryLocation: '',
      autoTransferPath: '',
      autoFileCopyEnabled: false,
      autoLaunchOnCopyEnabled: false,
      navToDirOnLaunch: false,
      syncFilesEnabled: false,
    },
    searchSettings: {
      weights: {
        nameWeight: 1,
        titleWeight: 1,
        creatorWeight: 1,
        releaseInfoWeight: 1,
        descriptionWeight: 1,
      },
      stopWords: [],
      bannedDirectories: [],
      bannedFiles: [],
    },
    appSettings: { setupCompleted: false },
    knownDevices: [],
    ...overrides,
  });

  const createMockFileItem = (overrides: Partial<FileItem> = {}): FileItem => ({
    name: 'test.sid',
    path: '/music/test.sid',
    size: 1024,
    isFavorite: false,
    isCompatible: true,
    title: 'Test',
    creator: '',
    releaseInfo: '',
    description: '',
    shareUrl: '',
    metadataSource: '',
    meta1: '',
    meta2: '',
    metadataSourcePath: '',
    parentPath: '/music',
    playLength: '0:00',
    subtuneLengths: [],
    startSubtuneNum: 0,
    images: [],
    type: FileItemType.Song,
    links: [],
    tags: [],
    youTubeVideos: [],
    competitions: [],
    ratingCount: 0,
    ...overrides,
  });

  const createRoute = (params: Record<string, string> = {}): ActivatedRouteSnapshot =>
    ({ queryParamMap: convertToParamMap(params) } as unknown as ActivatedRouteSnapshot);

  const runResolver = (route: ActivatedRouteSnapshot) =>
    TestBed.runInInjectionContext(() => playerRouteResolver(route, {} as RouterStateSnapshot));

  const waitUntil = async (predicate: () => boolean, timeoutMs = 3000, stepMs = 5) => {
    const start = Date.now();
    while (!predicate()) {
      TestBed.flushEffects();
      if (Date.now() - start > timeoutMs) {
        throw new Error('Timed out waiting for condition');
      }
      await new Promise((resolve) => setTimeout(resolve, stepMs));
    }
    TestBed.flushEffects();
  };

  beforeEach(() => {
    TestBed.resetTestingModule();

    mockStorageStore = {
      initializeStorage: vi.fn().mockResolvedValue(undefined),
      navigateToDirectory: vi.fn().mockResolvedValue(undefined),
      getSelectedDirectoryForDevice: vi.fn().mockReturnValue(null),
      getSelectedDirectoryState: vi.fn().mockReturnValue(() => null),
    };

    mockDeviceStore = {
      hasInitialised: vi.fn(() => true),
      devices: vi.fn(() => [createMockDevice()]),
    };

    mockPlayerContextService = {
      startListeningToPopState: vi.fn(),
      launchRandomFile: vi.fn().mockResolvedValue(undefined),
      setFilterMode: vi.fn(),
      launchFileWithContext: vi.fn().mockResolvedValue(undefined),
    };

    mockPlayerStorage = {
      load: vi.fn().mockReturnValue(null),
    };

    mockPlayerStore = {
      getCurrentFile: vi.fn(() => () => null),
    };

    mockSettingsStore = {
      getSettings: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: StorageStore, useValue: mockStorageStore },
        { provide: DeviceStore, useValue: mockDeviceStore },
        { provide: PlayerContextService, useValue: mockPlayerContextService },
        { provide: PLAYER_STORAGE, useValue: mockPlayerStorage },
        { provide: PlayerStore, useValue: mockPlayerStore },
        { provide: SettingsStore, useValue: mockSettingsStore },
      ],
    });
  });

  it('navigates on startup when the device has no held position', async () => {
    const settings = createMockSettings({
      playerSettings: {
        repeatModeOnStartup: false,
        playTimerEnabled: false,
        muteFastForward: false,
        muteRandomSeek: false,
        startupFilter: PlayerFilterType.All,
        startupLaunchEnabled: false,
        startupLaunchRandom: false,
      },
    });
    mockSettingsStore.getSettings.mockReturnValue(signal<Settings | null>(settings));
    mockStorageStore.getSelectedDirectoryForDevice.mockReturnValue(null);

    await runResolver(createRoute());
    await waitUntil(() => mockStorageStore.getSelectedDirectoryForDevice.mock.calls.length > 0);

    expect(mockStorageStore.navigateToDirectory).toHaveBeenCalledWith({
      deviceId,
      storageType: StorageType.Sd,
      path: '/',
    });
  });

  it('does not navigate on startup when the device already has a position and nothing to launch', async () => {
    const settings = createMockSettings({
      playerSettings: {
        repeatModeOnStartup: false,
        playTimerEnabled: false,
        muteFastForward: false,
        muteRandomSeek: false,
        startupFilter: PlayerFilterType.All,
        startupLaunchEnabled: false,
        startupLaunchRandom: false,
      },
    });
    mockSettingsStore.getSettings.mockReturnValue(signal<Settings | null>(settings));
    mockStorageStore.getSelectedDirectoryForDevice.mockReturnValue({
      deviceId,
      storageType: StorageType.Sd,
      path: '/games',
    });

    await runResolver(createRoute());
    await waitUntil(() => mockStorageStore.getSelectedDirectoryForDevice.mock.calls.length > 0);

    expect(mockStorageStore.navigateToDirectory).not.toHaveBeenCalled();
  });

  it('navigates on startup even with a held position when a saved file needs launching', async () => {
    const settings = createMockSettings({
      playerSettings: {
        repeatModeOnStartup: false,
        playTimerEnabled: false,
        muteFastForward: false,
        muteRandomSeek: false,
        startupFilter: PlayerFilterType.All,
        startupLaunchEnabled: true,
        startupLaunchRandom: false,
      },
    });
    mockSettingsStore.getSettings.mockReturnValue(signal<Settings | null>(settings));
    mockStorageStore.getSelectedDirectoryForDevice.mockReturnValue({
      deviceId,
      storageType: StorageType.Sd,
      path: '/games',
    });

    const savedFile = createMockFileItem({ name: 'saved.sid', parentPath: '/music' });
    mockPlayerStorage.load.mockReturnValue({
      currentFile: {
        storageKey: `${deviceId}-${StorageType.Sd}`,
        file: savedFile,
        parentPath: '/music',
        launchedAt: Date.now(),
        isCompatible: true,
      },
      launchMode: undefined,
    });

    await runResolver(createRoute());
    await waitUntil(() => mockStorageStore.getSelectedDirectoryForDevice.mock.calls.length > 0);

    expect(mockStorageStore.navigateToDirectory).toHaveBeenCalledWith({
      deviceId,
      storageType: StorageType.Sd,
      path: '/music',
    });
  });

  it('restores the saved file folder as browsing position even when auto-launch is disabled', async () => {
    const settings = createMockSettings({
      playerSettings: {
        repeatModeOnStartup: false,
        playTimerEnabled: false,
        muteFastForward: false,
        muteRandomSeek: false,
        startupFilter: PlayerFilterType.All,
        startupLaunchEnabled: false,
        startupLaunchRandom: false,
      },
    });
    mockSettingsStore.getSettings.mockReturnValue(signal<Settings | null>(settings));
    // The device already holds a position (as it would after storage initialization seeds one),
    // but that seeded root position must not block restoring the saved file's own folder.
    mockStorageStore.getSelectedDirectoryForDevice.mockReturnValue({
      deviceId,
      storageType: StorageType.Sd,
      path: '/',
    });

    const savedFile = createMockFileItem({ name: 'saved.sid', parentPath: '/music' });
    mockPlayerStorage.load.mockReturnValue({
      currentFile: {
        storageKey: `${deviceId}-${StorageType.Sd}`,
        file: savedFile,
        parentPath: '/music',
        launchedAt: Date.now(),
        isCompatible: true,
      },
      launchMode: undefined,
    });

    await runResolver(createRoute());
    await waitUntil(() => mockStorageStore.getSelectedDirectoryForDevice.mock.calls.length > 0);

    expect(mockStorageStore.navigateToDirectory).toHaveBeenCalledWith({
      deviceId,
      storageType: StorageType.Sd,
      path: '/music',
    });
    expect(mockPlayerContextService.launchFileWithContext).not.toHaveBeenCalled();
  });
});
