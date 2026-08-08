import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { of, type Observable } from 'rxjs';
import '@analogjs/vitest-angular/setup-zone';
import { TestBed, getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

import {
  StorageStore,
  StorageDirectoryState,
  SelectedDirectory,
  NavigationHistory,
} from './storage-store';
import {
  StorageDirectory,
  StorageType,
  IStorageService,
  STORAGE_SERVICE,
} from '@teensyrom-nx/domain';
import { StorageKeyUtil } from './storage-key.util';

type StorageStoreInstance = {
  storageEntries: () => Record<string, StorageDirectoryState>;
  selectedDirectories: () => Record<string, SelectedDirectory>;
  navigationHistory: () => Record<string, NavigationHistory>;
  navigationPin: () => string | null;
  initializeStorage: (args: { deviceId: string; storageType: StorageType }) => Promise<void>;
  navigateToDirectory: (args: {
    deviceId: string;
    storageType: StorageType;
    path: string;
  }) => Promise<void>;
  alignToPlayingFile: (args: {
    deviceId: string;
    storageType: StorageType;
    path: string;
  }) => Promise<void>;
  setNavigationPin: (args: { deviceId: string }) => void;
  clearNavigationPin: (args: { deviceId: string }) => void;
  getSelectedDirectoryForDevice: (deviceId: string) => SelectedDirectory | null;
};

describe('StorageStore navigation pin and seeding guards', () => {
  let store: StorageStoreInstance;
  type GetDirectoryFn = (
    deviceId: string,
    storageType: StorageType,
    path?: string
  ) => Observable<StorageDirectory>;
  let getDirectoryMock: MockedFunction<GetDirectoryFn>;
  let mockStorageService: IStorageService;

  const createMockStorageDirectory = (path = '/'): StorageDirectory => ({
    path,
    directories: [{ name: 'dir', path: `${path}/dir` }],
    files: [],
  });

  const createTestStore = () => {
    getDirectoryMock = vi.fn<GetDirectoryFn>();
    mockStorageService = {
      getDirectory: getDirectoryMock,
      index: vi.fn().mockResolvedValue({}),
      indexAll: vi.fn().mockResolvedValue({}),
      search: vi.fn(),
      saveFavorite: vi.fn(),
      removeFavorite: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: STORAGE_SERVICE, useValue: mockStorageService }],
    });

    store = TestBed.inject(StorageStore) as unknown as StorageStoreInstance;
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    try {
      getTestBed().initTestEnvironment(
        BrowserDynamicTestingModule,
        platformBrowserDynamicTesting()
      );
    } catch {
      // ignore if already initialized
    }
    createTestStore();
  });

  describe('navigationPin arbitration', () => {
    const deviceA = 'device-a';
    const deviceB = 'device-b';
    const storageType = StorageType.Sd;

    beforeEach(async () => {
      getDirectoryMock.mockReturnValue(of(createMockStorageDirectory('/')));
      await store.initializeStorage({ deviceId: deviceA, storageType });
      await store.initializeStorage({ deviceId: deviceB, storageType });
      getDirectoryMock.mockClear();
    });

    it('starts unpinned', () => {
      expect(store.navigationPin()).toBeNull();
    });

    it('alignToPlayingFile is a no-op when the device holds the pin', async () => {
      store.setNavigationPin({ deviceId: deviceA });
      expect(store.navigationPin()).toBe(deviceA);

      const selectedBefore = store.selectedDirectories()[deviceA];
      const entryBefore = store.storageEntries()[StorageKeyUtil.create(deviceA, storageType)];

      getDirectoryMock.mockReturnValue(of(createMockStorageDirectory('/games')));
      await store.alignToPlayingFile({ deviceId: deviceA, storageType, path: '/games' });

      expect(getDirectoryMock).not.toHaveBeenCalled();
      expect(store.selectedDirectories()[deviceA]).toEqual(selectedBefore);
      expect(store.storageEntries()[StorageKeyUtil.create(deviceA, storageType)]).toEqual(
        entryBefore
      );
    });

    it('alignToPlayingFile still navigates for an unpinned device', async () => {
      getDirectoryMock.mockReturnValue(of(createMockStorageDirectory('/games')));
      await store.alignToPlayingFile({ deviceId: deviceA, storageType, path: '/games' });

      expect(getDirectoryMock).toHaveBeenCalledWith(deviceA, storageType, '/games');
      expect(store.selectedDirectories()[deviceA].path).toBe('/games');
    });

    it('navigateToDirectory still navigates a device even while its pin is held', async () => {
      store.setNavigationPin({ deviceId: deviceA });

      getDirectoryMock.mockReturnValue(of(createMockStorageDirectory('/browsed')));
      await store.navigateToDirectory({ deviceId: deviceA, storageType, path: '/browsed' });

      expect(getDirectoryMock).toHaveBeenCalledWith(deviceA, storageType, '/browsed');
      expect(store.selectedDirectories()[deviceA].path).toBe('/browsed');
    });

    it('alignToPlayingFile still navigates a different, unpinned device', async () => {
      store.setNavigationPin({ deviceId: deviceA });

      getDirectoryMock.mockReturnValue(of(createMockStorageDirectory('/music')));
      await store.alignToPlayingFile({ deviceId: deviceB, storageType, path: '/music' });

      expect(getDirectoryMock).toHaveBeenCalledWith(deviceB, storageType, '/music');
      expect(store.selectedDirectories()[deviceB].path).toBe('/music');
    });

    it('alignToPlayingFile produces the same state transitions as navigateToDirectory when unpinned', async () => {
      getDirectoryMock.mockReturnValue(of(createMockStorageDirectory('/games')));
      await store.alignToPlayingFile({ deviceId: deviceA, storageType, path: '/games' });

      const key = StorageKeyUtil.create(deviceA, storageType);
      expect(store.storageEntries()[key].currentPath).toBe('/games');
      expect(store.storageEntries()[key].isLoaded).toBe(true);
      expect(store.navigationHistory()[deviceA].history).toContainEqual({
        path: '/games',
        storageType,
      });
    });

    it('clearNavigationPin is a no-op when owned by a different device', () => {
      store.setNavigationPin({ deviceId: deviceA });

      store.clearNavigationPin({ deviceId: deviceB });

      expect(store.navigationPin()).toBe(deviceA);
    });

    it('clearNavigationPin releases the pin when owned by the requesting device', () => {
      store.setNavigationPin({ deviceId: deviceA });

      store.clearNavigationPin({ deviceId: deviceA });

      expect(store.navigationPin()).toBeNull();
    });
  });

  describe('initializeStorage seeding guards', () => {
    const deviceId = 'device-1';
    const storageType = StorageType.Sd;

    it('leaves a device parked in a subdirectory untouched', async () => {
      getDirectoryMock.mockReturnValue(of(createMockStorageDirectory('/')));
      await store.initializeStorage({ deviceId, storageType });

      getDirectoryMock.mockReturnValue(of(createMockStorageDirectory('/games/arcade')));
      await store.navigateToDirectory({ deviceId, storageType, path: '/games/arcade' });

      const key = StorageKeyUtil.create(deviceId, storageType);
      const selectedBefore = store.selectedDirectories()[deviceId];
      const entryBefore = store.storageEntries()[key];
      const historyBefore = store.navigationHistory()[deviceId];

      getDirectoryMock.mockClear();
      await store.initializeStorage({ deviceId, storageType });

      expect(getDirectoryMock).not.toHaveBeenCalled();
      expect(store.selectedDirectories()[deviceId]).toEqual(selectedBefore);
      expect(store.storageEntries()[key]).toEqual(entryBefore);
      expect(store.navigationHistory()[deviceId]).toEqual(historyBefore);
    });

    it('still fetches and loads root for a first-time device', async () => {
      getDirectoryMock.mockReturnValue(of(createMockStorageDirectory('/')));

      await store.initializeStorage({ deviceId, storageType });

      const key = StorageKeyUtil.create(deviceId, storageType);
      expect(getDirectoryMock).toHaveBeenCalledWith(deviceId, storageType, '/');
      expect(store.storageEntries()[key].isLoaded).toBe(true);
      expect(store.storageEntries()[key].currentPath).toBe('/');
      expect(store.navigationHistory()[deviceId].history).toEqual([{ path: '/', storageType }]);
    });

    it('ends a dual-storage device on SD root, not USB', async () => {
      getDirectoryMock.mockReturnValue(of(createMockStorageDirectory('/')));

      await store.initializeStorage({ deviceId, storageType: StorageType.Sd });
      await store.initializeStorage({ deviceId, storageType: StorageType.Usb });

      expect(store.selectedDirectories()[deviceId]).toEqual({
        deviceId,
        storageType: StorageType.Sd,
        path: '/',
      });
    });
  });
});
