import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { of, type Observable } from 'rxjs';
import '@analogjs/vitest-angular/setup-zone';
import { TestBed, getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

import { StorageStore, StorageDirectoryState } from '../storage-store';
import {
  StorageType,
  IStorageService,
  STORAGE_SERVICE,
  FileItem,
  FileItemType,
  StorageDirectory,
} from '@teensyrom-nx/domain';
import { StorageKeyUtil } from '../storage-key.util';

// -----------------------------
// Type Definitions
// -----------------------------

type StorageStoreInstance = {
  storageEntries: () => Record<string, StorageDirectoryState>;
  updateFileCompatibility: (args: {
    deviceId: string;
    storageType: StorageType;
    filePath: string;
    isCompatible: boolean;
  }) => void;
  initializeStorage: (args: { deviceId: string; storageType: StorageType }) => Promise<void>;
  navigateToDirectory: (args: {
    deviceId: string;
    storageType: StorageType;
    path: string;
  }) => Promise<void>;
};

// -----------------------------
// Test Data Factories
// -----------------------------

const createMockStorageDirectory = (path = '/'): StorageDirectory => ({
  path,
  directories: [],
  files: [],
});

const createMockFileItem = (overrides: Partial<FileItem> = {}): FileItem => ({
  name: 'test.sid',
  path: '/test.sid',
  size: 1024,
  isFavorite: false,
  isCompatible: true,
  title: 'Test Title',
  creator: 'Test Creator',
  releaseInfo: '',
  description: '',
  shareUrl: '',
  metadataSource: '',
  meta1: '',
  meta2: '',
  metadataSourcePath: '',
  parentPath: '/',
  playLength: '0:00',
  subtuneLengths: [],
  startSubtuneNum: 0,
  images: [],
  type: FileItemType.Song,
  storageType: StorageType.Sd,
  links: [],
  tags: [],
  youTubeVideos: [],
  competitions: [],
  ratingCount: 0,
  ...overrides,
});

// -----------------------------
// Test Suite
// -----------------------------

describe('updateFileCompatibility action', () => {
  let store: StorageStoreInstance;
  type GetDirectoryFn = (
    deviceId: string,
    storageType: StorageType,
    path?: string
  ) => Observable<StorageDirectory>;
  let getDirectoryMock: MockedFunction<GetDirectoryFn>;
  let mockStorageService: IStorageService;

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
    // Ensure Angular testing environment is initialized (idempotent)
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

  it('should update file isCompatible flag to false when file exists', async () => {
    // Arrange
    const deviceId = 'device-1';
    const storageType = StorageType.Sd;
    const filePath = '/games/test.sid';
    const key = StorageKeyUtil.create(deviceId, storageType);

    // Setup directory with file
    const mockDirectory = createMockStorageDirectory('/games');
    mockDirectory.files = [createMockFileItem({ path: filePath, isCompatible: true })];

    getDirectoryMock.mockReturnValue(of(mockDirectory));
    await store.initializeStorage({ deviceId, storageType });
    await store.navigateToDirectory({ deviceId, storageType, path: '/games' });

    // Act
    store.updateFileCompatibility({ deviceId, storageType, filePath, isCompatible: false });

    // Assert
    const entry = store.storageEntries()[key];
    expect(entry.directory?.files?.[0].isCompatible).toBe(false);
  });

  it('should update file isCompatible flag to true when file exists', async () => {
    // Arrange
    const deviceId = 'device-1';
    const storageType = StorageType.Sd;
    const filePath = '/games/test.sid';
    const key = StorageKeyUtil.create(deviceId, storageType);

    // Setup directory with file
    const mockDirectory = createMockStorageDirectory('/games');
    mockDirectory.files = [createMockFileItem({ path: filePath, isCompatible: false })];

    getDirectoryMock.mockReturnValue(of(mockDirectory));
    await store.initializeStorage({ deviceId, storageType });
    await store.navigateToDirectory({ deviceId, storageType, path: '/games' });

    // Act
    store.updateFileCompatibility({ deviceId, storageType, filePath, isCompatible: true });

    // Assert
    const entry = store.storageEntries()[key];
    expect(entry.directory?.files?.[0].isCompatible).toBe(true);
  });

  it('should do nothing when storage entry does not exist', () => {
    // Arrange
    const deviceId = 'device-1';
    const storageType = StorageType.Sd;
    const filePath = '/games/test.sid';

    // Act - no initialization, so entry doesn't exist
    store.updateFileCompatibility({ deviceId, storageType, filePath, isCompatible: false });

    // Assert - should not throw error
    const entries = store.storageEntries();
    expect(Object.keys(entries).length).toBe(0);
  });

  it('should do nothing when file is not found in directory', async () => {
    // Arrange
    const deviceId = 'device-1';
    const storageType = StorageType.Sd;
    const filePath = '/games/nonexistent.sid';
    const key = StorageKeyUtil.create(deviceId, storageType);

    // Setup directory with different file
    const mockDirectory = createMockStorageDirectory('/games');
    mockDirectory.files = [
      createMockFileItem({ path: '/games/other.sid', isCompatible: true }),
    ];

    getDirectoryMock.mockReturnValue(of(mockDirectory));
    await store.initializeStorage({ deviceId, storageType });
    await store.navigateToDirectory({ deviceId, storageType, path: '/games' });

    // Act
    store.updateFileCompatibility({ deviceId, storageType, filePath, isCompatible: false });

    // Assert - file should remain unchanged
    const entry = store.storageEntries()[key];
    expect(entry.directory?.files?.[0].isCompatible).toBe(true);
    expect(entry.directory?.files?.[0].path).toBe('/games/other.sid');
  });

  it('should not mutate other files in the same directory', async () => {
    // Arrange
    const deviceId = 'device-1';
    const storageType = StorageType.Sd;
    const targetPath = '/games/target.sid';
    const key = StorageKeyUtil.create(deviceId, storageType);

    // Setup directory with multiple files
    const mockDirectory = createMockStorageDirectory('/games');
    mockDirectory.files = [
      createMockFileItem({ path: targetPath, isCompatible: true }),
      createMockFileItem({ path: '/games/other.sid', isCompatible: true }),
    ];

    getDirectoryMock.mockReturnValue(of(mockDirectory));
    await store.initializeStorage({ deviceId, storageType });
    await store.navigateToDirectory({ deviceId, storageType, path: '/games' });

    // Act
    store.updateFileCompatibility({ deviceId, storageType, filePath: targetPath, isCompatible: false });

    // Assert
    const entry = store.storageEntries()[key];
    const files = entry.directory?.files;

    expect(files?.[0].isCompatible).toBe(false); // Target file updated
    expect(files?.[1].isCompatible).toBe(true); // Other file unchanged
  });

  it('should be idempotent - multiple calls with same data produce same result', async () => {
    // Arrange
    const deviceId = 'device-1';
    const storageType = StorageType.Sd;
    const filePath = '/games/test.sid';
    const key = StorageKeyUtil.create(deviceId, storageType);

    // Setup directory with file
    const mockDirectory = createMockStorageDirectory('/games');
    mockDirectory.files = [createMockFileItem({ path: filePath, isCompatible: true })];

    getDirectoryMock.mockReturnValue(of(mockDirectory));
    await store.initializeStorage({ deviceId, storageType });
    await store.navigateToDirectory({ deviceId, storageType, path: '/games' });

    // Act - call multiple times
    store.updateFileCompatibility({ deviceId, storageType, filePath, isCompatible: false });
    const stateAfterFirst = store.storageEntries()[key].directory?.files[0];

    store.updateFileCompatibility({ deviceId, storageType, filePath, isCompatible: false });
    const stateAfterSecond = store.storageEntries()[key].directory?.files[0];

    // Assert - both results should be identical
    expect(stateAfterFirst).toEqual(stateAfterSecond);
    expect(stateAfterFirst?.isCompatible).toBe(false);
  });

  it('should perform immutable update - create new arrays', async () => {
    // Arrange
    const deviceId = 'device-1';
    const storageType = StorageType.Sd;
    const filePath = '/games/test.sid';
    const key = StorageKeyUtil.create(deviceId, storageType);

    // Setup directory with file
    const mockDirectory = createMockStorageDirectory('/games');
    mockDirectory.files = [createMockFileItem({ path: filePath, isCompatible: true })];

    getDirectoryMock.mockReturnValue(of(mockDirectory));
    await store.initializeStorage({ deviceId, storageType });
    await store.navigateToDirectory({ deviceId, storageType, path: '/games' });

    const filesReferenceBefore = store.storageEntries()[key].directory?.files;

    // Act
    store.updateFileCompatibility({ deviceId, storageType, filePath, isCompatible: false });

    // Assert - new array should be created
    const filesReferenceAfter = store.storageEntries()[key].directory?.files;
    expect(filesReferenceAfter).not.toBe(filesReferenceBefore);
  });
});
