import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { updateState } from '@angular-architects/ngrx-toolkit';
import {
  LaunchMode,
  PlayerStatus,
  PLAYER_SERVICE,
  PlayerScope,
  PlayerFilterType,
  DEVICE_SERVICE,
} from '@teensyrom-nx/domain';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { navigateNext } from './navigate-next';
import { PlayerStore, PlayerState, PlayerFileContext } from '../player-store';
import { WritableStore } from '../player-helpers';
import { PLAYER_STORAGE } from '../player-storage.interface';
import type { StorageKey } from '../../storage/storage-key.util';

describe('navigateNext', () => {
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
  const storageKey: StorageKey = 'device-music-SD';

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
          playTimerConfig: {
            enabled: false,
            durationMs: 0,
          },
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
      // Arrange: All files compatible, currently at index 0
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
              currentIndex: 0,
              storageKey,
            } as PlayerFileContext,
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song2.sid', isCompatible: true }))
      );

      // Act
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Should launch index 1 (next file) without skipping
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[1]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('B: should skip single incompatible file and select next compatible', async () => {
      // Arrange: Index 1 is incompatible, currently at index 0
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
              currentIndex: 0,
              storageKey,
            } as PlayerFileContext,
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song3.sid', isCompatible: true }))
      );

      // Act
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Should skip index 1 and launch index 2
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[2]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('C: should skip multiple consecutive incompatible files', async () => {
      // Arrange: Index 1, 2, 3 are incompatible, currently at index 0
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
              currentIndex: 0,
              storageKey,
            } as PlayerFileContext,
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song5.sid', isCompatible: true }))
      );

      // Act
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Should skip indices 1-3 and launch index 4
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[4]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('D: should wrap around end of array when skipping', async () => {
      // Arrange: Last file (index 2) is current, next file (index 0 after wrap) is incompatible
      const files = [
        createTestFileItem({ name: 'song1.sid', isCompatible: false }),
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
            } as PlayerFileContext,
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song2.sid', isCompatible: true }))
      );

      // Act
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Should wrap to index 0, skip it, and launch index 1
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[1]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('E: should set error state when all files are incompatible', async () => {
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
            } as PlayerFileContext,
          },
        },
      }));

      // Act
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Error state should be set, no throw
      const playerState = store.players()[deviceId];
      expect(playerState.error).toBe('All files in context are incompatible');
      expect(playerState.status).toBe(PlayerStatus.Stopped);
      
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
            } as PlayerFileContext,
          },
        },
      }));

      // Act: Should set error state after checking all 5 files once
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Error state should be set
      const playerState = store.players()[deviceId];
      expect(playerState.error).toBe('All files in context are incompatible');
      expect(playerState.status).toBe(PlayerStatus.Stopped);

      // Verify the loop terminated after files.length attempts
      expect(mockPlayerService.launchFile).not.toHaveBeenCalled();
    });

    it('G: should treat undefined isCompatible as compatible', async () => {
      // Arrange: Next file has undefined isCompatible (should be treated as compatible)
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
              currentIndex: 0,
              storageKey,
            } as PlayerFileContext,
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'song2.sid', isCompatible: undefined }))
      );

      // Act
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Should launch index 1 (treats undefined as compatible)
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[1]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('Search Mode - Compatibility Skipping', () => {
    beforeEach(() => {
      updateState(store, 'test-set-filecontext', (state) => ({
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
      // Arrange: All files compatible, currently at index 0
      const files = [
        createTestFileItem({ name: 'result1.sid', isCompatible: true }),
        createTestFileItem({ name: 'result2.sid', isCompatible: true }),
        createTestFileItem({ name: 'result3.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/search-results',
              files,
              currentIndex: 0,
              storageKey: 'search-test-query-SD',
            } as PlayerFileContext,
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'result2.sid', isCompatible: true }))
      );

      // Act
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Should launch index 1 (next file) without skipping
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[1]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('B: should skip single incompatible file and select next compatible', async () => {
      // Arrange: Index 1 is incompatible, currently at index 0
      const files = [
        createTestFileItem({ name: 'result1.sid', isCompatible: true }),
        createTestFileItem({ name: 'result2.sid', isCompatible: false }),
        createTestFileItem({ name: 'result3.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/search-results',
              files,
              currentIndex: 0,
              storageKey: 'search-test-query-SD',
            } as PlayerFileContext,
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'result3.sid', isCompatible: true }))
      );

      // Act
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Should skip index 1 and launch index 2
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[2]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('C: should skip multiple consecutive incompatible files', async () => {
      // Arrange: Index 1, 2, 3 are incompatible, currently at index 0
      const files = [
        createTestFileItem({ name: 'result1.sid', isCompatible: true }),
        createTestFileItem({ name: 'result2.sid', isCompatible: false }),
        createTestFileItem({ name: 'result3.sid', isCompatible: false }),
        createTestFileItem({ name: 'result4.sid', isCompatible: false }),
        createTestFileItem({ name: 'result5.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/search-results',
              files,
              currentIndex: 0,
              storageKey: 'search-test-query-SD',
            } as PlayerFileContext,
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'result5.sid', isCompatible: true }))
      );

      // Act
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Should skip indices 1-3 and launch index 4
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[4]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('D: should wrap around end of array when skipping', async () => {
      // Arrange: Last file (index 2) is current, next file (index 0 after wrap) is incompatible
      const files = [
        createTestFileItem({ name: 'result1.sid', isCompatible: false }),
        createTestFileItem({ name: 'result2.sid', isCompatible: true }),
        createTestFileItem({ name: 'result3.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/search-results',
              files,
              currentIndex: 2,
              storageKey: 'search-test-query-SD',
            } as PlayerFileContext,
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'result2.sid', isCompatible: true }))
      );

      // Act
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Should wrap to index 0, skip it, and launch index 1
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[1]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });

    it('E: should set error state when all files are incompatible', async () => {
      // Arrange: All files incompatible
      const files = [
        createTestFileItem({ name: 'result1.sid', isCompatible: false }),
        createTestFileItem({ name: 'result2.sid', isCompatible: false }),
        createTestFileItem({ name: 'result3.sid', isCompatible: false }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/search-results',
              files,
              currentIndex: 0,
              storageKey: 'search-test-query-SD',
            } as PlayerFileContext,
          },
        },
      }));

      // Act
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Error state should be set, no throw
      const playerState = store.players()[deviceId];
      expect(playerState.error).toBe('All files in context are incompatible');
      expect(playerState.status).toBe(PlayerStatus.Stopped);

      // Verify launchFile was never called
      expect(mockPlayerService.launchFile).not.toHaveBeenCalled();
    });

    it('F: should respect max attempts limit to prevent infinite loop', async () => {
      // Arrange: All files incompatible (max attempts = files.length = 5)
      const files = [
        createTestFileItem({ name: 'result1.sid', isCompatible: false }),
        createTestFileItem({ name: 'result2.sid', isCompatible: false }),
        createTestFileItem({ name: 'result3.sid', isCompatible: false }),
        createTestFileItem({ name: 'result4.sid', isCompatible: false }),
        createTestFileItem({ name: 'result5.sid', isCompatible: false }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/search-results',
              files,
              currentIndex: 0,
              storageKey: 'search-test-query-SD',
            } as PlayerFileContext,
          },
        },
      }));

      // Act: Should set error state after checking all 5 files once
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Error state should be set
      const playerState = store.players()[deviceId];
      expect(playerState.error).toBe('All files in context are incompatible');
      expect(playerState.status).toBe(PlayerStatus.Stopped);

      // Verify the loop terminated after files.length attempts
      expect(mockPlayerService.launchFile).not.toHaveBeenCalled();
    });

    it('G: should treat undefined isCompatible as compatible', async () => {
      // Arrange: Next file has undefined isCompatible (should be treated as compatible)
      const files = [
        createTestFileItem({ name: 'result1.sid', isCompatible: true }),
        createTestFileItem({ name: 'result2.sid', isCompatible: undefined }),
        createTestFileItem({ name: 'result3.sid', isCompatible: true }),
      ];

      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            fileContext: {
              directoryPath: '/search-results',
              files,
              currentIndex: 0,
              storageKey: 'search-test-query-SD',
            } as PlayerFileContext,
          },
        },
      }));

      vi.mocked(mockPlayerService.launchFile).mockReturnValue(
        of(createTestFileItem({ name: 'result2.sid', isCompatible: undefined }))
      );

      // Act
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Should launch index 1 (treats undefined as compatible)
      expect(mockPlayerService.launchFile).toHaveBeenCalledWith(deviceId, files[1]);
      expect(mockPlayerService.launchFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('Shuffle Mode - Unaffected', () => {
    beforeEach(() => {
      updateState(store, 'test-set-filecontext', (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            launchMode: LaunchMode.Shuffle,
            shuffleSettings: {
              scope: PlayerScope.Storage,
              filter: PlayerFilterType.All,
              startingDirectory: '/',
            },
          },
        },
      }));
    });

    it('should not apply skip logic in shuffle mode', async () => {
      // Arrange: Shuffle mode should use launchRandom, not skip logic
      vi.mocked(mockPlayerService.launchRandom).mockReturnValue(
        of(createTestFileItem({ name: 'random.sid', isCompatible: false }))
      );

      // Act
      const action = navigateNext(store, mockPlayerService, mockPlayerStorage);
      await action.navigateNext({ deviceId });

      // Assert: Should call launchRandom, not launchFile
      expect(mockPlayerService.launchRandom).toHaveBeenCalledWith(
        deviceId,
        PlayerScope.Storage,
        PlayerFilterType.All,
        '/'
      );
      expect(mockPlayerService.launchFile).not.toHaveBeenCalled();
    });
  });
});

