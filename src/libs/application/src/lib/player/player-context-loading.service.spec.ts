import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { updateState } from '@angular-architects/ngrx-toolkit';
import {
  FileItem,
  FileItemType,
  StorageType,
  LaunchMode,
  PLAYER_SERVICE,
  DEVICE_SERVICE,
  ALERT_SERVICE,
  IAlertService,
} from '@teensyrom-nx/domain';
import { PlayerContextService } from './player-context.service';
import { PlayerStore, PlayerState } from './player-store';
import { WritableStore } from './player-helpers';
import { StorageStore } from '../storage/storage-store';
import { SettingsStore } from '../settings/settings-store';
import { PLAYER_STORAGE } from './player-storage.interface';

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

/**
 * Tests for PlayerContextService.isSlowLoading() functionality
 *
 * This test suite verifies the slow loading indicator feature which:
 * - Returns a global Signal<boolean> tracking if ANY device is slow loading
 * - Uses a 2-second delay threshold before returning true
 * - Cancels the delay if loading completes quickly (< 2 seconds)
 * - Returns to false immediately when all loading completes
 * - Handles multiple devices loading concurrently
 *
 * NOTE: These tests use REAL timers with actual delays to avoid fake timer issues.
 * Test timeouts are set to accommodate the 2+ second delays.
 */
describe('PlayerContextService - isSlowLoading', () => {
  let service: PlayerContextService;
  let playerStore: WritableStore<PlayerState>;
  let mockPlayerService: {
    launchFile: ReturnType<typeof vi.fn>;
    launchRandom: ReturnType<typeof vi.fn>;
    toggleMusic: ReturnType<typeof vi.fn>;
  };
  let mockDeviceService: {
    findDevices: ReturnType<typeof vi.fn>;
    getConnectedDevices: ReturnType<typeof vi.fn>;
    connectDevice: ReturnType<typeof vi.fn>;
    disconnectDevice: ReturnType<typeof vi.fn>;
    resetDevice: ReturnType<typeof vi.fn>;
    pingDevice: ReturnType<typeof vi.fn>;
  };
  let mockStorageStore: {
    navigateToDirectory: ReturnType<typeof vi.fn>;
    getSelectedDirectoryState: ReturnType<typeof vi.fn>;
  };
  let mockSettingsStore: {
    settings: ReturnType<typeof vi.fn>;
  };
  let mockAlertService: IAlertService;

  // Helper to wait for async operations with real timers
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  // Helper function to update loading state in the store
  // Uses updateState helper from player-helpers to properly update store
  const setDeviceLoading = (deviceId: string, isLoading: boolean) => {
    const currentPlayers = playerStore.players();
    const current = currentPlayers[deviceId];
    if (!current) {
      return;
    }
    updateState(playerStore, 'test-set-loading', (state) => ({
      players: {
        ...state.players,
        [deviceId]: {
          ...current,
          isLoading,
        },
      },
    }));
  };

  beforeEach(() => {
    // Mock player service
    mockPlayerService = {
      launchFile: vi.fn(),
      launchRandom: vi.fn(),
      toggleMusic: vi.fn(),
    };

    mockDeviceService = {
      findDevices: vi.fn(),
      getConnectedDevices: vi.fn(),
      connectDevice: vi.fn(),
      disconnectDevice: vi.fn(),
      resetDevice: vi.fn(),
      pingDevice: vi.fn(),
    };

    mockStorageStore = {
      navigateToDirectory: vi.fn(),
      getSelectedDirectoryState: vi.fn(),
    };

    mockSettingsStore = {
      settings: vi.fn().mockReturnValue({
        playerSettings: {
          startupFilter: 0, // PlayerFilterType.All
          playTimerEnabled: false,
        },
      }),
    };

    mockAlertService = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      alerts$: of([]),
      show: vi.fn(),
      dismiss: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        PlayerContextService,
        PlayerStore,
        { provide: StorageStore, useValue: mockStorageStore },
        { provide: SettingsStore, useValue: mockSettingsStore },
        { provide: PLAYER_SERVICE, useValue: mockPlayerService },
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        { provide: ALERT_SERVICE, useValue: mockAlertService },
        {
          provide: PLAYER_STORAGE,
          useValue: {
            load: vi.fn().mockReturnValue(null),
            save: vi.fn(),
            hasSavedState: vi.fn().mockReturnValue(false),
            clear: vi.fn(),
          },
        },
      ],
    });

    service = TestBed.inject(PlayerContextService);
    playerStore = TestBed.inject(PlayerStore) as unknown as WritableStore<PlayerState>;
  });

  describe('Initial State', () => {
    it('should return false initially when no devices exist', () => {
      const slowLoadingSignal = service.isSlowLoading();
      expect(slowLoadingSignal()).toBe(false);
    });

    it('should return false when devices exist but none are loading', () => {
      service.initializePlayer('device1');
      const slowLoadingSignal = service.isSlowLoading();
      expect(slowLoadingSignal()).toBe(false);
    });

    it('should cache and return the same signal instance on multiple calls', () => {
      const signal1 = service.isSlowLoading();
      const signal2 = service.isSlowLoading();
      expect(signal1).toBe(signal2);
    });
  });

  describe('2-Second Delay Threshold', () => {
    it(
      'should return true after 2 seconds when device is loading',
      async () => {
        service.initializePlayer('device1');
        const slowLoadingSignal = service.isSlowLoading();

        setDeviceLoading('device1', true);
        expect(slowLoadingSignal()).toBe(false);

        // Wait 2+ seconds for the delay to trigger
        await wait(2100);
        expect(slowLoadingSignal()).toBe(true);
      },
      { timeout: 5000 }
    );

    it(
      'should stay false for fast launches that complete before 2 seconds',
      async () => {
        service.initializePlayer('device1');
        const slowLoadingSignal = service.isSlowLoading();

        setDeviceLoading('device1', true);
        expect(slowLoadingSignal()).toBe(false);

        // Complete before 2 seconds
        await wait(1000);
        setDeviceLoading('device1', false);

        // Wait past the 2-second mark
        await wait(1500);
        expect(slowLoadingSignal()).toBe(false);
      },
      { timeout: 5000 }
    );

    it(
      'should return false immediately when slow launch completes',
      async () => {
        service.initializePlayer('device1');
        const slowLoadingSignal = service.isSlowLoading();

        setDeviceLoading('device1', true);

        // Wait for slow loading to trigger
        await wait(2100);
        expect(slowLoadingSignal()).toBe(true);

        // Complete loading - should immediately go false
        setDeviceLoading('device1', false);
        await wait(50);
        expect(slowLoadingSignal()).toBe(false);
      },
      { timeout: 5000 }
    );
  });

  describe('Multiple Devices', () => {
    it(
      'should trigger slow loading when any device exceeds 2 seconds',
      async () => {
        service.initializePlayer('device1');
        service.initializePlayer('device2');
        const slowLoadingSignal = service.isSlowLoading();

        setDeviceLoading('device2', true);
        await wait(2100);

        expect(slowLoadingSignal()).toBe(true);
      },
      { timeout: 5000 }
    );

    it(
      'should return false when all devices complete',
      async () => {
        service.initializePlayer('device1');
        service.initializePlayer('device2');
        const slowLoadingSignal = service.isSlowLoading();

        setDeviceLoading('device1', true);
        setDeviceLoading('device2', true);

        await wait(2100);
        expect(slowLoadingSignal()).toBe(true);

        // Both complete
        setDeviceLoading('device1', false);
        setDeviceLoading('device2', false);
        await wait(50);

        expect(slowLoadingSignal()).toBe(false);
      },
      { timeout: 5000 }
    );
  });

  describe('Dynamic Device Management', () => {
    it(
      'should handle device removal',
      async () => {
        service.initializePlayer('device1');
        service.initializePlayer('device2');
        setDeviceLoading('device1', true);
        setDeviceLoading('device2', true);

        const slowLoadingSignal = service.isSlowLoading();
        await wait(2100);
        expect(slowLoadingSignal()).toBe(true);

        // Remove device1 - should still be true due to device2
        service.removePlayer('device1');
        await wait(50);
        expect(slowLoadingSignal()).toBe(true);

        // Stop device2
        setDeviceLoading('device2', false);
        await wait(50);
        expect(slowLoadingSignal()).toBe(false);
      },
      { timeout: 5000 }
    );
  });

  describe('Edge Cases', () => {
    it('should handle empty players object gracefully', () => {
      const slowLoadingSignal = service.isSlowLoading();
      expect(slowLoadingSignal()).toBe(false);
    });
  });

  describe('Integration with File Launch', () => {
    it(
      'should trigger slow loading during actual file launch',
      async () => {
        service.initializePlayer('device1');
        const slowLoadingSignal = service.isSlowLoading();
        const testFile = createTestFileItem();

        // Mock slow launch - must return Observable
        mockPlayerService.launchFile.mockImplementation(
          () =>
            new Observable((subscriber) => {
              setTimeout(() => {
                subscriber.next(testFile);
                subscriber.complete();
              }, 2500);
            })
        );

        // Start launch (don't await yet)
        const launchPromise = service.launchFileWithContext({
          deviceId: 'device1',
          storageType: StorageType.Sd,
          file: testFile,
          directoryPath: '/music',
          files: [testFile],
          launchMode: LaunchMode.Directory,
        });

        // Wait for slow loading threshold
        await wait(2100);
        expect(slowLoadingSignal()).toBe(true);

        // Complete launch
        await launchPromise;
        await wait(50);
        expect(slowLoadingSignal()).toBe(false);
      },
      { timeout: 6000 }
    );

    it(
      'should not trigger slow loading for fast file launches',
      async () => {
        service.initializePlayer('device1');
        const slowLoadingSignal = service.isSlowLoading();
        const testFile = createTestFileItem();

        // Mock fast launch - must return Observable
        mockPlayerService.launchFile.mockImplementation(
          () =>
            new Observable((subscriber) => {
              setTimeout(() => {
                subscriber.next(testFile);
                subscriber.complete();
              }, 500);
            })
        );

        // Launch and wait
        await service.launchFileWithContext({
          deviceId: 'device1',
          storageType: StorageType.Sd,
          file: testFile,
          directoryPath: '/music',
          files: [testFile],
          launchMode: LaunchMode.Directory,
        });

        // Wait past 2-second threshold
        await wait(2100);

        // Should still be false because launch completed quickly
        expect(slowLoadingSignal()).toBe(false);
      },
      { timeout: 5000 }
    );
  });
});


