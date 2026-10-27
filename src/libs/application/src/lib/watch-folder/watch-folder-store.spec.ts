import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@analogjs/vitest-angular/setup-zone';
import { TestBed } from '@angular/core/testing';
import {
  IWatchFolderService,
  StorageType,
  WATCH_FOLDER_SERVICE,
  WatchFolder,
  WatchFolderRejectedError,
  WatchFolderState,
} from '@teensyrom-nx/domain';
import { WatchFolderStore } from './watch-folder-store';

const folder = (id: string, overrides: Partial<WatchFolder> = {}): WatchFolder => ({
  id,
  path: `C:\\${id}`,
  enabled: true,
  state: WatchFolderState.Watching,
  destinations: [
    { id: `${id}-d1`, deviceId: 'dev-1', deviceName: 'Rack', storageType: StorageType.Sd, path: '/a', launch: false },
  ],
  ...overrides,
});

const addInput = {
  path: 'C:\\new',
  deviceId: 'dev-1',
  storageType: StorageType.Sd,
  devicePath: null,
  launch: false,
};

describe('WatchFolderStore', () => {
  let service: { [K in keyof IWatchFolderService]: ReturnType<typeof vi.fn> };
  let store: InstanceType<typeof WatchFolderStore>;

  beforeEach(() => {
    service = {
      list: vi.fn().mockResolvedValue([]),
      add: vi.fn(),
      setDestination: vi.fn(),
      setEnabled: vi.fn(),
      remove: vi.fn(),
      removeDestination: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: WATCH_FOLDER_SERVICE, useValue: service }],
    });
    store = TestBed.inject(WatchFolderStore);
  });

  describe('loadWatchFolders', () => {
    it('replaces the folders with the engine list', async () => {
      service.list.mockResolvedValue([folder('a'), folder('b')]);

      await store.loadWatchFolders();

      expect(store.getFolders()().map((f) => f.id)).toEqual(['a', 'b']);
      expect(store.isLoading()).toBe(false);
      expect(store.error()).toBeNull();
    });

    it('records a list-level failure and keeps the earlier folders', async () => {
      service.list.mockResolvedValueOnce([folder('a')]);
      await store.loadWatchFolders();
      service.list.mockRejectedValueOnce(new Error('engine down'));

      await store.loadWatchFolders();

      expect(store.error()).toBe('engine down');
      expect(store.getFolders()()).toHaveLength(1);
    });
  });

  describe('setFolderEnabled', () => {
    it('replaces the folder with the one returned and clears pending', async () => {
      service.list.mockResolvedValue([folder('a'), folder('b')]);
      await store.loadWatchFolders();
      service.setEnabled.mockResolvedValue(
        folder('a', { enabled: false, state: WatchFolderState.Off })
      );

      await store.setFolderEnabled({ watchFolderId: 'a', enabled: false });

      const [a, b] = store.getFolders()();
      expect(a.state).toBe(WatchFolderState.Off);
      expect(b.state).toBe(WatchFolderState.Watching);
      expect(store.isPending('a')()).toBe(false);
    });

    it('marks the folder pending while the change is in flight', async () => {
      service.list.mockResolvedValue([folder('a')]);
      await store.loadWatchFolders();
      let release: (f: WatchFolder) => void = () => undefined;
      service.setEnabled.mockReturnValue(new Promise<WatchFolder>((r) => (release = r)));

      const pending = store.setFolderEnabled({ watchFolderId: 'a', enabled: false });

      expect(store.isPending('a')()).toBe(true);
      release(folder('a'));
      await pending;
      expect(store.isPending('a')()).toBe(false);
    });

    it('sets the error and leaves the folder as it was when the change fails', async () => {
      service.list.mockResolvedValue([folder('a')]);
      await store.loadWatchFolders();
      service.setEnabled.mockRejectedValue(new Error('refused'));

      await store.setFolderEnabled({ watchFolderId: 'a', enabled: false });

      expect(store.error()).toBe('refused');
      expect(store.getFolders()()[0].enabled).toBe(true);
      expect(store.isPending('a')()).toBe(false);
    });
  });

  describe('removal', () => {
    beforeEach(async () => {
      service.list.mockResolvedValue([
        folder('a'),
        folder('b', {
          destinations: [
            ...folder('b').destinations,
            { id: 'b-d2', deviceId: 'dev-2', deviceName: null, storageType: StorageType.Usb, path: '/b', launch: true },
          ],
        }),
      ]);
      await store.loadWatchFolders();
    });

    it('drops a removed folder', async () => {
      service.remove.mockResolvedValue(undefined);

      await store.removeFolder({ watchFolderId: 'a' });

      expect(store.getFolders()().map((f) => f.id)).toEqual(['b']);
    });

    it('keeps the folder with its remaining devices when a device is removed', async () => {
      const remaining = folder('b');
      service.removeDestination.mockResolvedValue({ folderRemoved: false, watchFolder: remaining });

      await store.removeDestination({ watchFolderId: 'b', deviceId: 'dev-2' });

      expect(store.getFolders()().find((f) => f.id === 'b')?.destinations).toHaveLength(1);
    });

    it('drops the folder when its last device is removed', async () => {
      service.removeDestination.mockResolvedValue({ folderRemoved: true, watchFolder: null });

      await store.removeDestination({ watchFolderId: 'a', deviceId: 'dev-1' });

      expect(store.getFolders()().map((f) => f.id)).toEqual(['b']);
    });

    it('sets the error and keeps the folder when a removal fails', async () => {
      service.remove.mockRejectedValue(new Error('cannot'));

      await store.removeFolder({ watchFolderId: 'a' });

      expect(store.error()).toBe('cannot');
      expect(store.getFolders()()).toHaveLength(2);
    });
  });

  describe('addWatchFolder and setDestination', () => {
    it('adds a new folder and resolves null', async () => {
      service.add.mockResolvedValue(folder('n'));

      const result = await store.addWatchFolder(addInput);

      expect(result).toBeNull();
      expect(store.getFolders()().map((f) => f.id)).toEqual(['n']);
    });

    it('replaces a folder already listed when a device is added to it', async () => {
      service.list.mockResolvedValue([folder('a')]);
      await store.loadWatchFolders();
      const grown = folder('a', {
        destinations: [
          ...folder('a').destinations,
          { id: 'x', deviceId: 'dev-2', deviceName: null, storageType: StorageType.Sd, path: '/z', launch: false },
        ],
      });
      service.add.mockResolvedValue(grown);

      await store.addWatchFolder(addInput);

      expect(store.getFolders()()).toHaveLength(1);
      expect(store.getFolders()()[0].destinations).toHaveLength(2);
    });

    it('returns the engine rejection with its field and does not write it to the list error', async () => {
      service.add.mockRejectedValue(new WatchFolderRejectedError(400, 'Not a folder', 'folder'));

      const result = await store.addWatchFolder(addInput);

      expect(result).toEqual({ message: 'Not a folder', field: 'folder' });
      expect(store.error()).toBeNull();
      expect(store.getFolders()()).toEqual([]);
    });

    it('returns an unknown failure as a rejection with no field', async () => {
      service.setDestination.mockRejectedValue(new Error('boom'));

      const result = await store.setDestination({
        watchFolderId: 'a',
        deviceId: 'dev-1',
        change: { launch: true },
      });

      expect(result).toEqual({ message: 'boom', field: null });
      expect(store.error()).toBeNull();
      expect(store.isPending('a')()).toBe(false);
    });

    it('replaces the folder and resolves null when a destination is saved', async () => {
      service.list.mockResolvedValue([folder('a')]);
      await store.loadWatchFolders();
      const changed = folder('a');
      changed.destinations[0].launch = true;
      service.setDestination.mockResolvedValue(changed);

      const result = await store.setDestination({
        watchFolderId: 'a',
        deviceId: 'dev-1',
        change: { launch: true },
      });

      expect(result).toBeNull();
      expect(store.getFolders()()[0].destinations[0].launch).toBe(true);
    });
  });
});
