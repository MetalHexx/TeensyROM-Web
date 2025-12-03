import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PlayerStorageService } from './player-storage.service';
import { DevicePlayerState } from '@teensyrom-nx/application';
import {
  LaunchMode,
  PlayerStatus,
  PlayerFilterType,
  PlayerScope,
  FileItemType,
} from '@teensyrom-nx/domain';

describe('PlayerStorageService', () => {
  let service: PlayerStorageService;
  let localStorageSpy: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
  };

  const createMockDeviceState = (deviceId: string): DevicePlayerState => ({
    deviceId,
    currentFile: {
      storageKey: `${deviceId}-SD`,
      file: {
        name: 'test.sid',
        path: '/music/test.sid',
        type: FileItemType.Song,
        size: 1024,
        isFavorite: false,
        isCompatible: true,
        title: 'Test Song',
        creator: 'Test Creator',
        releaseInfo: '2024',
        description: '',
        shareUrl: '',
        metadataSource: '',
        meta1: '',
        meta2: '',
        metadataSourcePath: '',
        parentPath: '/music',
        playLength: '3:00',
        subtuneLengths: [],
        startSubtuneNum: 0,
        images: [],
        links: [],
        tags: [],
        youTubeVideos: [],
        competitions: [],
        ratingCount: 0,
      },
      parentPath: '/music',
      launchedAt: Date.now(),
      isCompatible: true,
    },
    fileContext: {
      storageKey: `${deviceId}-SD`,
      directoryPath: '/music',
      files: [],
      currentIndex: 0,
    },
    status: PlayerStatus.Playing,
    launchMode: LaunchMode.Shuffle,
    shuffleSettings: {
      scope: PlayerScope.Storage,
      filter: PlayerFilterType.Music,
    },
    playHistory: {
      entries: [],
      currentPosition: -1,
    },
    historyViewVisible: false,
    playTimerConfig: {
      enabled: true,
      durationMs: 180000,
    },
    isLoading: false,
    error: null,
    lastUpdated: Date.now(),
  });

  beforeEach(() => {
    // Mock localStorage
    localStorageSpy = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: localStorageSpy,
      writable: true,
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [PlayerStorageService],
    });

    service = TestBed.inject(PlayerStorageService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('save', () => {
    it('should persist device state to localStorage', () => {
      const deviceState = createMockDeviceState('device-123');

      service.save('device-123', deviceState);

      expect(localStorageSpy.setItem).toHaveBeenCalledWith(
        'teensyrom_player_device-123',
        expect.any(String)
      );

      const savedData = JSON.parse(localStorageSpy.setItem.mock.calls[0][1] as string);
      expect(savedData.deviceId).toBe('device-123');
      expect(savedData.currentFile).toBeDefined();
      expect(savedData.launchMode).toBe(LaunchMode.Shuffle);
    });

    it('should exclude ephemeral state fields', () => {
      const deviceState = createMockDeviceState('device-123');

      service.save('device-123', deviceState);

      const savedData = JSON.parse(localStorageSpy.setItem.mock.calls[0][1] as string);
      expect(savedData.isLoading).toBeUndefined();
      expect(savedData.error).toBeUndefined();
      expect(savedData.status).toBeUndefined();
      expect(savedData.timerState).toBeUndefined();
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageSpy.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const deviceState = createMockDeviceState('device-123');

      // Should not throw, error is logged instead
      expect(() => service.save('device-123', deviceState)).not.toThrow();
    });
  });

  describe('load', () => {
    it('should load saved state and return DevicePlayerState with ephemeral fields reset', () => {
      const savedState = {
        deviceId: 'device-123',
        currentFile: {
          storageKey: 'device-123-SD',
          file: {
            name: 'saved.sid',
            path: '/music/saved.sid',
            type: FileItemType.Song,
            size: 2048,
            isFavorite: false,
            isCompatible: true,
            title: 'Saved Song',
            creator: 'Saved Creator',
            releaseInfo: '2024',
            description: '',
            shareUrl: '',
            metadataSource: '',
            meta1: '',
            meta2: '',
            metadataSourcePath: '',
            parentPath: '/music',
            playLength: '2:30',
            subtuneLengths: [],
            startSubtuneNum: 0,
            images: [],
            links: [],
            tags: [],
            youTubeVideos: [],
            competitions: [],
            ratingCount: 0,
          },
          parentPath: '/music',
          launchedAt: 1000,
          isCompatible: true,
        },
        fileContext: null,
        launchMode: LaunchMode.Directory,
        shuffleSettings: {
          scope: PlayerScope.Storage,
          filter: PlayerFilterType.All,
        },
        playHistory: null,
        historyViewVisible: true,
        playTimerConfig: {
          enabled: false,
          durationMs: 120000,
        },
        lastUpdated: 2000,
      };

      localStorageSpy.getItem.mockReturnValue(JSON.stringify(savedState));

      const result = service.load('device-123');

      // Persisted fields from saved state
      expect(result).not.toBeNull();
      if (result === null) return; // Type guard for TypeScript

      expect(result.currentFile?.file.name).toBe('saved.sid');
      expect(result.launchMode).toBe(LaunchMode.Directory);
      expect(result.historyViewVisible).toBe(true);
      expect(result.playTimerConfig.enabled).toBe(false);

      // Ephemeral fields are reset to defaults (not from any baseline)
      expect(result.status).toBe(PlayerStatus.Stopped);
      expect(result.isLoading).toBe(false);
      expect(result.error).toBe(null);
    });

    it('should return null when no saved state exists', () => {
      localStorageSpy.getItem.mockReturnValue(null);

      const result = service.load('device-123');

      expect(result).toBeNull();
    });

    it('should return null on localStorage read errors', () => {
      localStorageSpy.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = service.load('device-123');

      expect(result).toBeNull();
    });

    it('should return null on malformed JSON', () => {
      localStorageSpy.getItem.mockReturnValue('{ invalid json }');

      const result = service.load('device-123');

      expect(result).toBeNull();
    });
  });

  describe('hasSavedState', () => {
    it('should return true when saved state exists', () => {
      localStorageSpy.getItem.mockReturnValue('{}');

      expect(service.hasSavedState('device-123')).toBe(true);
      expect(localStorageSpy.getItem).toHaveBeenCalledWith('teensyrom_player_device-123');
    });

    it('should return false when no saved state exists', () => {
      localStorageSpy.getItem.mockReturnValue(null);

      expect(service.hasSavedState('device-123')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove saved state from localStorage', () => {
      service.clear('device-123');

      expect(localStorageSpy.removeItem).toHaveBeenCalledWith('teensyrom_player_device-123');
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageSpy.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw, error is logged instead
      expect(() => service.clear('device-123')).not.toThrow();
    });
  });
});
