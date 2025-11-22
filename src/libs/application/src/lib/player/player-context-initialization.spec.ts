import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  ALERT_SERVICE,
  IAlertService,
  PlayerFilterType,
  AlertMessage,
} from '@teensyrom-nx/domain';
import { PlayerContextService } from './player-context.service';
import { PlayerStore } from './player-store';
import { StorageStore } from '../storage/storage-store';
import { SettingsStore } from '../settings/settings-store';
import { PlayerTimerManager } from './player-timer-manager';
import { PLAYER_STORAGE } from './player-storage.interface';

describe('PlayerContextService - Initialization with Storage', () => {
  let service: PlayerContextService;
  let mockPlayerStore: {
    initializePlayer: ReturnType<typeof vi.fn>;
    getDevicePlayer: ReturnType<typeof vi.fn>;
  };
  let mockStorageStore: {
    navigateToDirectory: ReturnType<typeof vi.fn>;
    getSelectedDirectoryState: ReturnType<typeof vi.fn>;
  };
  let mockSettingsStore: {
    settings: ReturnType<typeof vi.fn>;
  };
  let mockAlertService: Partial<IAlertService>;
  let mockTimerManager: Partial<PlayerTimerManager>;
  let mockPlayerStorage: {
    save: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
    hasSavedState: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  const deviceId = 'device-init-test';

  beforeEach(() => {
    mockPlayerStore = {
      initializePlayer: vi.fn(),
      getDevicePlayer: vi.fn(),
    };

    mockStorageStore = {
      navigateToDirectory: vi.fn().mockResolvedValue(undefined),
      getSelectedDirectoryState: vi.fn(),
    };

    mockSettingsStore = {
      settings: vi.fn(() => ({
        connectionSettings: {
          connectionType: 'Serial' as const,
          autoConnectEnabled: false,
        },
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
            nameWeight: 1.0,
            titleWeight: 1.0,
            creatorWeight: 1.0,
            releaseInfoWeight: 1.0,
            descriptionWeight: 1.0,
          },
          stopWords: [],
          bannedDirectories: [],
          bannedFiles: [],
        },
        appSettings: {
          setupCompleted: false,
        },
      })),
    };

    mockAlertService = {
      alerts$: new Subject<AlertMessage[]>().asObservable(),
      show: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
    };

    mockPlayerStorage = {
      save: vi.fn(),
      load: vi.fn().mockReturnValue({}),
      hasSavedState: vi.fn().mockReturnValue(false),
      clear: vi.fn(),
    };

    mockTimerManager = {
      createTimer: vi.fn(),
      destroyTimer: vi.fn(),
      pauseTimer: vi.fn(),
      resumeTimer: vi.fn(),
      stopTimer: vi.fn(),
      onTimerUpdate$: () => new Subject(),
      onTimerComplete$: () => new Subject(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PlayerContextService,
        { provide: PlayerStore, useValue: mockPlayerStore },
        { provide: StorageStore, useValue: mockStorageStore },
        { provide: SettingsStore, useValue: mockSettingsStore },
        { provide: PlayerTimerManager, useValue: mockTimerManager },
        { provide: ALERT_SERVICE, useValue: mockAlertService },
        {
          provide: PLAYER_STORAGE,
          useValue: mockPlayerStorage,
        },
      ],
    });

    service = TestBed.inject(PlayerContextService);
  });

  describe('initializePlayer', () => {
    it('should call store.initializePlayer with settings', () => {
      service.initializePlayer(deviceId);

      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.All,
        playTimerEnabled: false,
      });
    });

    it('should use custom settings when provided', () => {
      // Override settings to provide custom startup filter
      mockSettingsStore.settings.mockReturnValue({
        playerSettings: {
          startupFilter: PlayerFilterType.Games,
          playTimerEnabled: true,
        },
      });

      service.initializePlayer(deviceId);

      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.Games,
        playTimerEnabled: true,
      });
    });

    it('should handle missing settings gracefully', () => {
      mockSettingsStore.settings.mockReturnValue(null);

      service.initializePlayer(deviceId);

      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.All,
        playTimerEnabled: false,
      });
    });
  });
});
