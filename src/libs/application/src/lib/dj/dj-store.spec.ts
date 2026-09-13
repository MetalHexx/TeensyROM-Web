import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { of, throwError, from, type Observable } from 'rxjs';
import '@analogjs/vitest-angular/setup-zone';
import { TestBed, getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

import { DjStore, DjFileEntry } from './dj-store';
import { DjFileKeyUtil } from './dj-file-key.util';
import {
  FileContent,
  StorageType,
  IFileContentService,
  FILE_CONTENT_SERVICE,
} from '@teensyrom-nx/domain';

type DjStoreInstance = {
  files: () => Record<string, DjFileEntry>;
  retrieveFile: (args: {
    deviceId: string;
    storageType: StorageType;
    path: string;
  }) => Promise<void>;
  getFile: (
    deviceId: string,
    storageType: StorageType,
    path: string
  ) => () => DjFileEntry | undefined;
};

describe('DjStore (NgRx Signal Store)', () => {
  let store: DjStoreInstance;
  type GetFileContentFn = (
    deviceId: string,
    storageType: StorageType,
    path: string
  ) => Observable<FileContent>;
  let getFileContentMock: MockedFunction<GetFileContentFn>;
  let mockFileContentService: IFileContentService;

  const createMockFileContent = (overrides: Partial<FileContent> = {}): FileContent => ({
    bytes: new Uint8Array([1, 2, 3]).buffer,
    byteLength: 3,
    fileName: 'test.sid',
    ...overrides,
  });

  const createTestStore = () => {
    getFileContentMock = vi.fn<GetFileContentFn>();
    mockFileContentService = {
      getFileContent: getFileContentMock,
    };

    TestBed.configureTestingModule({
      providers: [{ provide: FILE_CONTENT_SERVICE, useValue: mockFileContentService }],
    });

    store = TestBed.inject(DjStore) as unknown as DjStoreInstance;
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

  describe('Store Setup', () => {
    it('should be injectable via TestBed (providedIn: root)', () => {
      expect(store).toBeDefined();
    });

    it('should initialize with an empty files map', () => {
      expect(store.files()).toEqual({});
    });
  });

  describe('retrieveFile', () => {
    const deviceId = 'device-1';
    const storageType = StorageType.Sd;
    const path = '/music/test.sid';
    const key = DjFileKeyUtil.create(deviceId, storageType, path);

    it('lands retrieving then retrieved with the bytes and byte length', async () => {
      let resolveFn!: (value: FileContent) => void;
      const pending = new Promise<FileContent>((resolve) => {
        resolveFn = resolve;
      });
      getFileContentMock.mockReturnValue(from(pending));

      const call = store.retrieveFile({ deviceId, storageType, path });

      const retrievingEntry = store.files()[key];
      expect(retrievingEntry.status).toBe('retrieving');
      expect(retrievingEntry.fileName).toBe('test.sid');
      expect(retrievingEntry.error).toBeNull();

      const fileContent = createMockFileContent();
      resolveFn(fileContent);
      await call;

      const retrievedEntry = store.files()[key];
      expect(retrievedEntry.status).toBe('retrieved');
      expect(retrievedEntry.bytes).toBe(fileContent.bytes);
      expect(retrievedEntry.byteLength).toBe(fileContent.byteLength);
      expect(retrievedEntry.error).toBeNull();

      expect(getFileContentMock).toHaveBeenCalledWith(deviceId, storageType, path);
    });

    it('lands failed with the error text and null bytes on failure', async () => {
      getFileContentMock.mockReturnValue(throwError(() => new Error('Network error')));

      await store.retrieveFile({ deviceId, storageType, path });

      const entry = store.files()[key];
      expect(entry.status).toBe('failed');
      expect(entry.bytes).toBeNull();
      expect(entry.error).toBe('Network error');
    });

    it('does not call the service a second time for an already-retrieved key', async () => {
      getFileContentMock.mockReturnValue(of(createMockFileContent()));
      await store.retrieveFile({ deviceId, storageType, path });

      getFileContentMock.mockClear();
      await store.retrieveFile({ deviceId, storageType, path });

      expect(getFileContentMock).not.toHaveBeenCalled();
    });

    it('calls the service again for a key that previously failed', async () => {
      getFileContentMock.mockReturnValue(throwError(() => new Error('Network error')));
      await store.retrieveFile({ deviceId, storageType, path });

      getFileContentMock.mockReturnValue(of(createMockFileContent()));
      await store.retrieveFile({ deviceId, storageType, path });

      expect(getFileContentMock).toHaveBeenCalledTimes(2);
      expect(store.files()[key].status).toBe('retrieved');
    });

    it('keys entries as `${deviceId}-${storageType}-${path}`', async () => {
      getFileContentMock.mockReturnValue(of(createMockFileContent()));
      await store.retrieveFile({ deviceId, storageType, path });

      expect(Object.keys(store.files())).toContain(`${deviceId}-${storageType}-${path}`);
    });
  });

  describe('getFile', () => {
    it('returns the entry for the matching device, storage type and path', async () => {
      const deviceId = 'device-2';
      const storageType = StorageType.Usb;
      const path = '/games/game.prg';
      getFileContentMock.mockReturnValue(of(createMockFileContent({ fileName: 'game.prg' })));

      await store.retrieveFile({ deviceId, storageType, path });

      const entry = store.getFile(deviceId, storageType, path)();
      expect(entry?.status).toBe('retrieved');
      expect(entry?.fileName).toBe('game.prg');
    });

    it('returns undefined when no entry exists for the key', () => {
      expect(store.getFile('unknown-device', StorageType.Sd, '/nope.sid')()).toBeUndefined();
    });
  });
});
