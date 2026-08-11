import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  FileItem,
  FileItemType,
  StorageType,
  PlayerStatus,
  PLAYER_SERVICE,
  DEVICE_SERVICE,
  ALERT_SERVICE,
  IAlertService,
  PLAYER_LAUNCH_DELAY_MS,
  PLAYER_INCOMPATIBLE_RETRY_DELAY_MS,
  PLAYER_TIMER_TICK_MS,
} from '@teensyrom-nx/domain';
import { PlayerContextService } from './player-context.service';
import { PlayerStore } from './player-store';
import { StorageStore, StorageDirectoryState } from '../storage/storage-store';
import { SettingsStore } from '../settings/settings-store';
import { TimerState } from './timer-state.interface';
import { DEFAULT_TIMER_MS } from './player.constants';
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
 * Phase 1: Custom Play Timer Tests
 *
 * Tests custom play timer functionality including state management,
 * timer setup logic with priority rules, and integration with existing timer system.
 */
describe('PlayerContextService - Custom Play Timer', () => {
  let service: PlayerContextService;
  let mockStorageStore: {
    alignToPlayingFile: ReturnType<typeof vi.fn>;
    getSelectedDirectoryState: ReturnType<typeof vi.fn>;
    updateFileCompatibility: ReturnType<typeof vi.fn>;
  };
  let mockSettingsStore: {
    settings: ReturnType<typeof vi.fn>;
  };
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
  let mockAlertService: IAlertService;

  const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));

  const waitForTimerState = async (
    deviceId: string,
    maxAttempts = 50
  ): Promise<TimerState | null> => {
    for (let i = 0; i < maxAttempts; i++) {
      await nextTick();
      const state = service.getTimerState(deviceId)();
      if (state !== null) {
        return state;
      }
    }
    return null;
  };

  beforeEach(() => {
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
      alignToPlayingFile: vi.fn(),
      getSelectedDirectoryState: vi.fn(),
      updateFileCompatibility: vi.fn(),
    };

    mockSettingsStore = {
      settings: vi.fn(),
    };

    mockAlertService = {
      show: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
      alerts$: of([]),
    } as IAlertService;

    mockSettingsStore.settings.mockReturnValue({
      playerSettings: {
        startupFilter: 'ALL',
      },
    });

    TestBed.configureTestingModule({
      providers: [
        PlayerContextService,
        PlayerStore,
        { provide: PLAYER_SERVICE, useValue: mockPlayerService },
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        { provide: ALERT_SERVICE, useValue: mockAlertService },
        { provide: StorageStore, useValue: mockStorageStore },
        { provide: SettingsStore, useValue: mockSettingsStore },
        {
          provide: PLAYER_STORAGE,
          useValue: { load: vi.fn(), save: vi.fn(), hasSavedState: vi.fn(), clear: vi.fn() },
        },
        { provide: PLAYER_LAUNCH_DELAY_MS, useValue: 0 },
        { provide: PLAYER_INCOMPATIBLE_RETRY_DELAY_MS, useValue: 0 },
        { provide: PLAYER_TIMER_TICK_MS, useValue: 0 },
      ],
    });

    service = TestBed.inject(PlayerContextService);
  });

  const deviceId = 'device-custom-timer-test';
  const file1 = createTestFileItem({ name: 'song1.sid', path: '/music/song1.sid' });
  const gameFile = createTestFileItem({
    name: 'game.prg',
    path: '/games/game.prg',
    type: FileItemType.Game,
    playLength: '',
  });
  const imageFile = createTestFileItem({
    name: 'image.png',
    path: '/images/image.png',
    type: FileItemType.Image,
    playLength: '',
  });
  const hexFile = createTestFileItem({
    name: 'program.hex',
    path: '/hex/program.hex',
    type: FileItemType.Hex,
    playLength: '',
  });
  const testFiles = [file1, gameFile, imageFile];

  beforeEach(() => {
    mockStorageStore.getSelectedDirectoryState.mockReturnValue(
      of({
        deviceId: 'test-device',
        currentPath: '/music',
        directory: {
          name: 'music',
          path: '/music',
          files: testFiles,
          directories: [],
        },
        isLoaded: true,
        isLoading: false,
        error: null,
        lastLoadTime: Date.now(),
      } as unknown as StorageDirectoryState)
    );
  });

  describe('State Management & Initialization', () => {
    it('should initialize playTimerConfig with correct defaults', () => {
      service.initializePlayer(deviceId);

      const config = service.getPlayTimerConfig(deviceId)();
      expect(config).not.toBeNull();
      expect(config?.enabled).toBe(false);
      expect(config?.durationMs).toBe(DEFAULT_TIMER_MS);
    });

    it('should persist playTimerConfig after initialization', async () => {
      service.initializePlayer(deviceId);

      // Launch a file
      mockPlayerService.launchFile.mockReturnValue(of(file1));
      await service.launchFileWithContext({
        deviceId,
        file: file1,
        directoryPath: '/music',
        files: testFiles,
      });
      await nextTick();

      // Config should still exist
      const config = service.getPlayTimerConfig(deviceId)();
      expect(config).not.toBeNull();
      expect(config?.enabled).toBe(false);
      expect(config?.durationMs).toBe(DEFAULT_TIMER_MS);
    });
  });

  describe('Update Player Timer Action', () => {
    beforeEach(() => {
      service.initializePlayer(deviceId);
    });

    it('should enable custom timer and update duration', async () => {
      // Enable custom timer with 30 seconds
      service.setCustomTimer(deviceId, true, 30000);
      await nextTick();

      const config = service.getPlayTimerConfig(deviceId)();
      expect(config).not.toBeNull();
      expect(config?.enabled).toBe(true);
      expect(config?.durationMs).toBe(30000);
    });

    it('should update duration while enabled', async () => {
      // Enable and set to 10 seconds
      service.setCustomTimer(deviceId, true, 10000);
      await nextTick();

      // Change duration to 60 seconds
      service.setCustomTimer(deviceId, true, 60000);
      await nextTick();

      const config = service.getPlayTimerConfig(deviceId)();
      expect(config?.enabled).toBe(true);
      expect(config?.durationMs).toBe(60000);
    });

    it('should disable custom timer', async () => {
      // Enable first
      service.setCustomTimer(deviceId, true, 30000);
      await nextTick();

      // Disable
      service.setCustomTimer(deviceId, false, 30000);
      await nextTick();

      const config = service.getPlayTimerConfig(deviceId)();
      expect(config?.enabled).toBe(false);
      expect(config?.durationMs).toBe(30000); // Duration persists
    });

    it('should update both enabled and duration simultaneously', async () => {
      service.setCustomTimer(deviceId, true, 45000);
      await nextTick();

      const config = service.getPlayTimerConfig(deviceId)();
      expect(config?.enabled).toBe(true);
      expect(config?.durationMs).toBe(45000);
    });

    it('should preserve other player state when updating timer config', async () => {
      // Launch a file first
      mockPlayerService.launchFile.mockReturnValue(of(file1));
      await service.launchFileWithContext({
        deviceId,
        file: file1,
        directoryPath: '/music',
        files: testFiles,
      });
      await nextTick();

      const fileBeforeUpdate = service.getCurrentFile(deviceId)();

      // Update timer config
      service.setCustomTimer(deviceId, true, 15000);
      await nextTick();

      // Other state should be preserved
      const fileAfterUpdate = service.getCurrentFile(deviceId)();
      expect(fileAfterUpdate?.file.name).toBe(fileBeforeUpdate?.file.name);
      expect(service.getPlayerStatus(deviceId)()).toBe(PlayerStatus.Playing);
    });
  });

  describe('Timer Setup Logic - Custom Timer Enabled', () => {
    beforeEach(() => {
      service.initializePlayer(deviceId);
    });

    it('should use metadata duration for music file even when custom timer enabled', async () => {
      // Enable custom timer with 30 seconds
      service.setCustomTimer(deviceId, true, 30000);
      await nextTick();

      // Launch music file with 3:45 metadata
      mockPlayerService.launchFile.mockReturnValue(of(file1));
      await service.launchFileWithContext({
        deviceId,
        file: file1,
        directoryPath: '/music',
        files: testFiles,
      });
      await nextTick();

      const timerState = await waitForTimerState(deviceId);
      expect(timerState).not.toBeNull();
      expect(timerState?.totalTime).toBe(225000); // Metadata duration (3:45), NOT custom timer
    });

    it('should create timer for game file when custom timer enabled', async () => {
      // Enable custom timer with 60 seconds
      service.setCustomTimer(deviceId, true, 60000);
      await nextTick();

      // Launch game file (no timer by default)
      mockPlayerService.launchFile.mockReturnValue(of(gameFile));
      await service.launchFileWithContext({
        deviceId,
        file: gameFile,
        directoryPath: '/games',
        files: [gameFile],
      });
      await nextTick();

      const timerState = await waitForTimerState(deviceId);
      expect(timerState).not.toBeNull();
      expect(timerState?.totalTime).toBe(60000); // Custom timer enabled
    });

    it('should create timer for image file when custom timer enabled', async () => {
      // Enable custom timer with 10 seconds
      service.setCustomTimer(deviceId, true, 10000);
      await nextTick();

      // Launch image file (no timer by default)
      mockPlayerService.launchFile.mockReturnValue(of(imageFile));
      await service.launchFileWithContext({
        deviceId,
        file: imageFile,
        directoryPath: '/images',
        files: [imageFile],
      });
      await nextTick();

      const timerState = await waitForTimerState(deviceId);
      expect(timerState).not.toBeNull();
      expect(timerState?.totalTime).toBe(10000); // Custom timer for images
    });

    it('should NOT create timer for .Hex file even when custom timer enabled', async () => {
      // Enable custom timer
      service.setCustomTimer(deviceId, true, 30000);
      await nextTick();

      // Launch .Hex file
      mockPlayerService.launchFile.mockReturnValue(of(hexFile));
      await service.launchFileWithContext({
        deviceId,
        file: hexFile,
        directoryPath: '/hex',
        files: [hexFile],
      });
      await nextTick();

      const timerState = service.getTimerState(deviceId)();
      expect(timerState).toBeNull(); // .Hex files excluded from timers
    });
  });

  describe('Timer Setup Logic - Custom Timer Disabled', () => {
    beforeEach(() => {
      service.initializePlayer(deviceId);
    });

    it('should use metadata duration for music file when custom timer disabled', async () => {
      // Custom timer disabled by default
      const config = service.getPlayTimerConfig(deviceId)();
      expect(config?.enabled).toBe(false);

      // Launch music file with 3:45 metadata (225000ms)
      mockPlayerService.launchFile.mockReturnValue(of(file1));
      await service.launchFileWithContext({
        deviceId,
        file: file1,
        directoryPath: '/music',
        files: testFiles,
      });
      await nextTick();

      const timerState = await waitForTimerState(deviceId);
      expect(timerState).not.toBeNull();
      expect(timerState?.totalTime).toBe(225000); // Metadata duration
    });

    it('should NOT create timer for game file when custom timer disabled', async () => {
      // Custom timer disabled by default
      const config = service.getPlayTimerConfig(deviceId)();
      expect(config?.enabled).toBe(false);

      // Launch game file
      mockPlayerService.launchFile.mockReturnValue(of(gameFile));
      await service.launchFileWithContext({
        deviceId,
        file: gameFile,
        directoryPath: '/games',
        files: [gameFile],
      });
      await nextTick();

      const timerState = service.getTimerState(deviceId)();
      expect(timerState).toBeNull(); // No timer for games by default
    });

    it('should NOT create timer for image file when custom timer disabled', async () => {
      // Custom timer disabled by default
      const config = service.getPlayTimerConfig(deviceId)();
      expect(config?.enabled).toBe(false);

      // Launch image file
      mockPlayerService.launchFile.mockReturnValue(of(imageFile));
      await service.launchFileWithContext({
        deviceId,
        file: imageFile,
        directoryPath: '/images',
        files: [imageFile],
      });
      await nextTick();

      const timerState = service.getTimerState(deviceId)();
      expect(timerState).toBeNull(); // No timer for images by default
    });
  });

  describe('Custom Timer State Changes Mid-Session', () => {
    beforeEach(() => {
      service.initializePlayer(deviceId);
    });

    it('should apply custom timer when enabled after launching non-timer file', async () => {
      // Launch game file without custom timer (no timer)
      mockPlayerService.launchFile.mockReturnValue(of(gameFile));
      await service.launchFileWithContext({
        deviceId,
        file: gameFile,
        directoryPath: '/games',
        files: [gameFile],
      });
      await nextTick();

      let timerState = service.getTimerState(deviceId)();
      expect(timerState).toBeNull(); // No timer initially

      // Enable custom timer
      service.setCustomTimer(deviceId, true, 20000);
      await nextTick();

      // Launch another file
      mockPlayerService.launchFile.mockReturnValue(of(imageFile));
      await service.launchFileWithContext({
        deviceId,
        file: imageFile,
        directoryPath: '/images',
        files: [imageFile],
      });
      await nextTick();

      timerState = await waitForTimerState(deviceId);
      expect(timerState).not.toBeNull();
      expect(timerState?.totalTime).toBe(20000); // Custom timer now active
    });

    it('should remove custom timer when disabled after launching timer file', async () => {
      // Enable custom timer first
      service.setCustomTimer(deviceId, true, 15000);
      await nextTick();

      // Launch game file with custom timer
      mockPlayerService.launchFile.mockReturnValue(of(gameFile));
      await service.launchFileWithContext({
        deviceId,
        file: gameFile,
        directoryPath: '/games',
        files: [gameFile],
      });
      await nextTick();

      let timerState = await waitForTimerState(deviceId);
      expect(timerState?.totalTime).toBe(15000); // Custom timer active

      // Disable custom timer
      service.setCustomTimer(deviceId, false, 15000);
      await nextTick();

      // Launch another game file
      mockPlayerService.launchFile.mockReturnValue(of(gameFile));
      await service.launchFileWithContext({
        deviceId,
        file: gameFile,
        directoryPath: '/games',
        files: [gameFile],
      });
      await nextTick();

      timerState = service.getTimerState(deviceId)();
      expect(timerState).toBeNull(); // Timer removed
    });
  });

  describe('Custom Timer Duration Persistence', () => {
    beforeEach(() => {
      service.initializePlayer(deviceId);
    });

    it('should persist custom duration across multiple file launches', async () => {
      // Set custom timer with 25 seconds
      service.setCustomTimer(deviceId, true, 25000);
      await nextTick();

      // Launch first file
      mockPlayerService.launchFile.mockReturnValue(of(gameFile));
      await service.launchFileWithContext({
        deviceId,
        file: gameFile,
        directoryPath: '/games',
        files: [gameFile, imageFile],
      });
      await nextTick();

      let timerState = await waitForTimerState(deviceId);
      expect(timerState?.totalTime).toBe(25000);

      // Launch second file
      mockPlayerService.launchFile.mockReturnValue(of(imageFile));
      await service.launchFileWithContext({
        deviceId,
        file: imageFile,
        directoryPath: '/images',
        files: [imageFile],
      });
      await nextTick();

      timerState = await waitForTimerState(deviceId);
      expect(timerState?.totalTime).toBe(25000); // Same duration
    });

    it('should use updated duration for next file launch', async () => {
      // Initial custom timer
      service.setCustomTimer(deviceId, true, 30000);
      await nextTick();

      // Launch file
      mockPlayerService.launchFile.mockReturnValue(of(gameFile));
      await service.launchFileWithContext({
        deviceId,
        file: gameFile,
        directoryPath: '/games',
        files: [gameFile, imageFile],
      });
      await nextTick();

      let timerState = await waitForTimerState(deviceId);
      expect(timerState?.totalTime).toBe(30000);

      // Update duration
      service.setCustomTimer(deviceId, true, 5000);
      await nextTick();

      // Launch next file
      mockPlayerService.launchFile.mockReturnValue(of(imageFile));
      await service.launchFileWithContext({
        deviceId,
        file: imageFile,
        directoryPath: '/images',
        files: [imageFile],
      });
      await nextTick();

      timerState = await waitForTimerState(deviceId);
      expect(timerState?.totalTime).toBe(5000); // Updated duration
    });
  });

  describe('Selector: getPlayTimerConfig', () => {
    it('should return null for non-existent device', () => {
      const config = service.getPlayTimerConfig('non-existent-device')();
      expect(config).toBeNull();
    });

    it('should return config after initialization', () => {
      service.initializePlayer(deviceId);

      const config = service.getPlayTimerConfig(deviceId)();
      expect(config).not.toBeNull();
      expect(config?.enabled).toBe(false);
      expect(config?.durationMs).toBe(DEFAULT_TIMER_MS);
    });

    it('should reactively update when config changes', async () => {
      service.initializePlayer(deviceId);

      const configSignal = service.getPlayTimerConfig(deviceId);
      let config = configSignal();
      expect(config?.enabled).toBe(false);

      // Update config
      service.setCustomTimer(deviceId, true, 50000);
      await nextTick();

      config = configSignal();
      expect(config?.enabled).toBe(true);
      expect(config?.durationMs).toBe(50000);
    });
  });
});
