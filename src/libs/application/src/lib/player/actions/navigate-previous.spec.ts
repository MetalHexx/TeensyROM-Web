import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { updateState } from '@angular-architects/ngrx-toolkit';
import {
  FileItem,
  FileItemType,
  LaunchMode,
  PlayerStatus,
  PLAYER_SERVICE,
  PlayerScope,
  PlayerFilterType,
  DEVICE_SERVICE,
} from '@teensyrom-nx/domain';
import { navigatePrevious } from './navigate-previous';
import { PlayerStore, PlayerState } from '../player-store';
import { WritableStore } from '../player-helpers';
import { PLAYER_STORAGE } from '../player-storage.interface';

const createTestFileItem = (overrides: Partial<FileItem> = {}): FileItem => ({
  name: 'test-file.sid',
  path: '/music/test-file.sid',
  size: 4096,
  type: FileItemType.Song,
  isFavorite: false,
  isCompatible: true,
  title: 'Test Song',
  creator: 'Test Artist',
  releaseInfo: '2025',
  description: 'Test song description',
  shareUrl: '',
  metadataSource: '',
  meta1: '',
  meta2: '',
  metadataSourcePath: '',
  parentPath: '/music',
  playLength: '3:45',
  subtuneLengths: [],
  startSubtuneNum: 0,
  images: [],
  links: [],
  tags: [],
  youTubeVideos: [],
  competitions: [],
  ratingCount: 0,
  ...overrides,
});

describe('navigatePrevious', () => {
  let store: WritableStore<PlayerState>;
  let mockPlayerService: {
    launchFile: ReturnType<typeof vi.fn>;
    launchRandom: ReturnType<typeof vi.fn>;
    toggleMusic: ReturnType<typeof vi.fn>;
    getPlayerState: ReturnType<typeof vi.fn>;
    getDevices: ReturnType<typeof vi.fn>;
  };
  let mockDeviceService: {
    findDevices: ReturnType<typeof vi.fn>;
    getConnectedDevices: ReturnType<typeof vi.fn>;
    connectDevice: ReturnType<typeof vi.fn>;
    disconnectDevice: ReturnType<typeof vi.fn>;
    resetDevice: ReturnType<typeof vi.fn>;
    pingDevice: ReturnType<typeof vi.fn>;
  };
  let mockPlayerStorage: {
    save: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
    hasSavedState: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  const deviceId = 'test-device-1';
  const storageKey = 'directory:/music-SD' as const;

  beforeEach(() => {
    mockPlayerService = {
      launchFile: vi.fn(),
      launchRandom: vi.fn(),
      toggleMusic: vi.fn(),
      getPlayerState: vi.fn(),
      getDevices: vi.fn(),
    };

    mockDeviceService = {
      findDevices: vi.fn(),
      getConnectedDevices: vi.fn(),
      connectDevice: vi.fn(),
      disconnectDevice: vi.fn(),
      resetDevice: vi.fn(),
      pingDevice: vi.fn(),
    };

    mockPlayerStorage = {
      save: vi.fn(),
      load: vi.fn(),
      hasSavedState: vi.fn(),
      clear: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        PlayerStore,
        { provide: PLAYER_SERVICE, useValue: mockPlayerService },
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        { provide: PLAYER_STORAGE, useValue: mockPlayerStorage },
      ],
    });

    store = TestBed.inject(PlayerStore) as unknown as WritableStore<PlayerState>;

    // Initialize player with default state
    updateState(store, 'test-init-player', (state) => ({
      players: {
        ...state.players,
        [deviceId]: {
          deviceId,
          status: PlayerStatus.Playing,
          launchMode: LaunchMode.Directory,
          currentFile: null,
          fileContext: null,
          shuffleSettings: {
            scope: PlayerScope.Storage,
            filter: PlayerFilterType.All,
            startingDirectory: '/',
          },
          history: [],
          playHistory: null,
          historyViewVisible: false,
          playTimerConfig: { enabled: false, durationMs: 0 },
          isLoading: false,
          lastUpdated: null,
          error: null,
        },
      },
    }));
  });

  describe('Directory Mode - Compatibility Skipping', () => {
    beforeEach(() => {
      updateState(store, 'test-set-directory-mode', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            launchMode: LaunchMode.Directory,
          },
        },
      }));
    });

    it('A: should select compatible file immediately without skipping', async () => {
      // Arrange: All files compatible, currently at index 2
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: true }),
        createTestFileItem({ name: 'song2.sid', isCompatible: true }),
        createTestFileItem({ name: 'song3.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/music',
              files,
              currentIndex: 2,
              storageKey,
            },
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song2.sid', isCompatible: true }))
      );

      // Act
      const action = navigatePrevious(store, mockPlayerService, mockPlayerStorage);
      await action.navigatePrevious({ deviceId });

      // Assert: Should launch index 1 (previous file) without skipping
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[1]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('B: should skip single incompatible file and select previous compatible', async () => {
      // Arrange: Index 1 is incompatible, currently at index 2
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: true }),
        createTestFileItem({ name: 'song2.sid', isCompatible: false }),
        createTestFileItem({ name: 'song3.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/music',
              files,
              currentIndex: 2,
              storageKey,
            },
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song1.sid', isCompatible: true }))
      );

      // Act
      const action = navigatePrevious(store, mockPlayerService, mockPlayerStorage);
      await action.navigatePrevious({ deviceId });

      // Assert: Should skip index 1 and launch index 0
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[0]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('C: should skip multiple consecutive incompatible files', async () => {
      // Arrange: Index 1, 2, 3 are incompatible, currently at index 4
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: true }),
        createTestFileItem({ name: 'song2.sid', isCompatible: false }),
        createTestFileItem({ name: 'song3.sid', isCompatible: false }),
        createTestFileItem({ name: 'song4.sid', isCompatible: false }),
        createTestFileItem({ name: 'song5.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {              directoryPath: '/music',              files,
              currentIndex: 4,
              storageKey,
            },
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song1.sid', isCompatible: true }))
      );

      // Act
      const action = navigatePrevious(store, mockPlayerService, mockPlayerStorage);
      await action.navigatePrevious({ deviceId });

      // Assert: Should skip indices 3-1 and launch index 0
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[0]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('D: should wrap around start of array when skipping backward', async () => {
      // Arrange: First file (index 0) is current, previous files (indices 2,1 after wrap) are incompatible
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: true }),
        createTestFileItem({ name: 'song2.sid', isCompatible: false }),
        createTestFileItem({ name: 'song3.sid', isCompatible: false }),
        createTestFileItem({ name: 'song4.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {              directoryPath: '/music',              files,
              currentIndex: 0,
              storageKey,
            },
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song4.sid', isCompatible: true }))
      );

      // Act
      const action = navigatePrevious(store, mockPlayerService, mockPlayerStorage);
      await action.navigatePrevious({ deviceId });

      // Assert: Should wrap to end, skip indices 2,1, and launch index 3
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[3]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('E: should throw error when all files are incompatible', async () => {
      // Arrange: All files incompatible
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: false }),
        createTestFileItem({ name: 'song2.sid', isCompatible: false }),
        createTestFileItem({ name: 'song3.sid', isCompatible: false }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/music',
              files,
              currentIndex: 0,
              storageKey,
            },
          },
        },
      }));

      // Act & Assert
      const action = navigatePrevious(store, mockPlayerService, mockPlayerStorage);
      await expect(action.navigatePrevious({ deviceId })).rejects.toThrow(
        'All files in context are incompatible'
      );

      // Verify launchFile was never called
      expect(mockPlayerService.launchFile).not.toHaveBeenCalled();
    });

    it('F: should respect max attempts limit to prevent infinite loop', async () => {
      // Arrange: All files incompatible (max attempts = files.length = 5)
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: false }),
        createTestFileItem({ name: 'song2.sid', isCompatible: false }),
        createTestFileItem({ name: 'song3.sid', isCompatible: false }),
        createTestFileItem({ name: 'song4.sid', isCompatible: false }),
        createTestFileItem({ name: 'song5.sid', isCompatible: false }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/music',
              files,
              currentIndex: 0,
              storageKey,
            },
          },
        },
      }));

      // Act & Assert: Should throw after checking all 5 files once
      const action = navigatePrevious(store, mockPlayerService, mockPlayerStorage);
      await expect(action.navigatePrevious({ deviceId })).rejects.toThrow(
        'All files in context are incompatible'
      );

      // Verify the loop terminated after files.length attempts
      expect(mockPlayerService.launchFile).not.toHaveBeenCalled();
    });

    it('G: should treat undefined isCompatible as compatible', async () => {
      // Arrange: Previous file has undefined isCompatible (should be treated as compatible)
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: true }),
        createTestFileItem({ name: 'song2.sid', isCompatible: undefined }),
        createTestFileItem({ name: 'song3.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/music',
              files,
              currentIndex: 2,
              storageKey,
            },
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song2.sid', isCompatible: undefined }))
      );

      // Act
      const action = navigatePrevious(store, mockPlayerService, mockPlayerStorage);
      await action.navigatePrevious({ deviceId });

      // Assert: Should launch index 1 (treats undefined as compatible)
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[1]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('Search Mode - Compatibility Skipping', () => {
    beforeEach(() => {
      updateState(store, 'test-set-search-mode', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            launchMode: LaunchMode.Search,
          },
        },
      }));
    });

    it('A: should select compatible file immediately without skipping', async () => {
      // Arrange: All files compatible, currently at index 2
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: true }),
        createTestFileItem({ name: 'song2.sid', isCompatible: true }),
        createTestFileItem({ name: 'song3.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/music',
              files,
              currentIndex: 2,
              storageKey,
            },
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song2.sid', isCompatible: true }))
      );

      // Act
      const action = navigatePrevious(store, mockPlayerService, mockPlayerStorage);
      await action.navigatePrevious({ deviceId });

      // Assert: Should launch index 1 (previous file) without skipping
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[1]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('B: should skip single incompatible file and select previous compatible', async () => {
      // Arrange: Index 1 is incompatible, currently at index 2
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: true }),
        createTestFileItem({ name: 'song2.sid', isCompatible: false }),
        createTestFileItem({ name: 'song3.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/music',
              files,
              currentIndex: 2,
              storageKey,
            },
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song1.sid', isCompatible: true }))
      );

      // Act
      const action = navigatePrevious(store, mockPlayerService, mockPlayerStorage);
      await action.navigatePrevious({ deviceId });

      // Assert: Should skip index 1 and launch index 0
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[0]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('C: should skip multiple consecutive incompatible files', async () => {
      // Arrange: Index 1, 2, 3 are incompatible, currently at index 4
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: true }),
        createTestFileItem({ name: 'song2.sid', isCompatible: false }),
        createTestFileItem({ name: 'song3.sid', isCompatible: false }),
        createTestFileItem({ name: 'song4.sid', isCompatible: false }),
        createTestFileItem({ name: 'song5.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/music',
              files,
              currentIndex: 4,
              storageKey,
            },
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song1.sid', isCompatible: true }))
      );

      // Act
      const action = navigatePrevious(store, mockPlayerService, mockPlayerStorage);
      await action.navigatePrevious({ deviceId });

      // Assert: Should skip indices 3-1 and launch index 0
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[0]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('D: should wrap around start of array when skipping backward', async () => {
      // Arrange: First file (index 0) is current, previous files (indices 2,1 after wrap) are incompatible
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: true }),
        createTestFileItem({ name: 'song2.sid', isCompatible: false }),
        createTestFileItem({ name: 'song3.sid', isCompatible: false }),
        createTestFileItem({ name: 'song4.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/music',
              files,
              currentIndex: 0,
              storageKey,
            },
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song4.sid', isCompatible: true }))
      );

      // Act
      const action = navigatePrevious(store, mockPlayerService, mockPlayerStorage);
      await action.navigatePrevious({ deviceId });

      // Assert: Should wrap to end, skip indices 2,1, and launch index 3
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[3]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('E: should throw error when all files are incompatible', async () => {
      // Arrange: All files incompatible
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: false }),
        createTestFileItem({ name: 'song2.sid', isCompatible: false }),
        createTestFileItem({ name: 'song3.sid', isCompatible: false }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/music',
              files,
              currentIndex: 0,
              storageKey,
            },
          },
        },
      }));

      // Act & Assert
      const action = navigatePrevious(store, mockPlayerService, mockPlayerStorage);
      await expect(action.navigatePrevious({ deviceId })).rejects.toThrow(
        'All files in context are incompatible'
      );

      // Verify launchFile was never called
      expect(mockPlayerService.launchFile).not.toHaveBeenCalled();
    });

    it('F: should respect max attempts limit to prevent infinite loop', async () => {
      // Arrange: All files incompatible (max attempts = files.length = 5)
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: false }),
        createTestFileItem({ name: 'song2.sid', isCompatible: false }),
        createTestFileItem({ name: 'song3.sid', isCompatible: false }),
        createTestFileItem({ name: 'song4.sid', isCompatible: false }),
        createTestFileItem({ name: 'song5.sid', isCompatible: false }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/music',
              files,
              currentIndex: 0,
              storageKey,
            },
          },
        },
      }));

      // Act & Assert: Should throw after checking all 5 files once
      const action = navigatePrevious(store, mockPlayerService, mockPlayerStorage);
      await expect(action.navigatePrevious({ deviceId })).rejects.toThrow(
        'All files in context are incompatible'
      );

      // Verify the loop terminated after files.length attempts
      expect(mockPlayerService.launchFile).not.toHaveBeenCalled();
    });

    it('G: should treat undefined isCompatible as compatible', async () => {
      // Arrange: Previous file has undefined isCompatible (should be treated as compatible)
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: true }),
        createTestFileItem({ name: 'song2.sid', isCompatible: undefined }),
        createTestFileItem({ name: 'song3.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/music',
              files,
              currentIndex: 2,
              storageKey,
            },
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song2.sid', isCompatible: undefined }))
      );

      // Act
      const action = navigatePrevious(store, mockPlayerService, mockPlayerStorage);
      await action.navigatePrevious({ deviceId });

      // Assert: Should launch index 1 (treats undefined as compatible)
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[1]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });
  });
});


