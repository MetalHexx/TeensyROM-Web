import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ALERT_SERVICE, IAlertService, PlayerFilterType, AlertMessage } from '@teensyrom-nx/domain';
import { PlayerContextService } from './player-context.service';
import { PlayerStore } from './player-store';
import { StorageStore } from '../storage/storage-store';
import { SettingsStore } from '../settings/settings-store';
import { PlayerTimerManager } from './player-timer-manager';
import { PLAYER_STORAGE } from './player-storage.interface';

describe('PlayerContextService - Settings Integration', () => {
  let service: PlayerContextService;
  let mockPlayerStore: {
    initializePlayer: ReturnType<typeof vi.fn>;
    updateShuffleSettings: ReturnType<typeof vi.fn>;
    updatePlayerTimer: ReturnType<typeof vi.fn>;
  };
  let mockStorageStore: {
    alignToPlayingFile: ReturnType<typeof vi.fn>;
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
  let timerUpdateSubject: Subject<{ deviceId: string; currentMs: number; totalMs: number }>;
  let timerCompleteSubject: Subject<void>;

  const deviceId = 'device-settings-test';

  beforeEach(() => {
    timerUpdateSubject = new Subject();
    timerCompleteSubject = new Subject<void>();

    mockPlayerStore = {
      initializePlayer: vi.fn(),
      updateShuffleSettings: vi.fn(),
      updatePlayerTimer: vi.fn(),
    };

    mockStorageStore = {
      alignToPlayingFile: vi.fn().mockResolvedValue(undefined),
      getSelectedDirectoryState: vi.fn(),
    };

    mockSettingsStore = {
      settings: vi.fn(() => ({
        playerSettings: {
          repeatModeOnStartup: false,
          playTimerEnabled: true,
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
      createTimer: vi.fn<PlayerTimerManager['createTimer']>(),
      destroyTimer: vi.fn<PlayerTimerManager['destroyTimer']>(),
      pauseTimer: vi.fn<PlayerTimerManager['pauseTimer']>(),
      resumeTimer: vi.fn<PlayerTimerManager['resumeTimer']>(),
      stopTimer: vi.fn<PlayerTimerManager['stopTimer']>(),
      setSpeed: vi.fn<PlayerTimerManager['setSpeed']>(),
      getTimerState: vi.fn<PlayerTimerManager['getTimerState']>(),
      onTimerUpdate$: vi.fn().mockReturnValue(timerUpdateSubject.asObservable()),
      onTimerComplete$: vi
        .fn<PlayerTimerManager['onTimerComplete$']>()
        .mockReturnValue(timerCompleteSubject.asObservable()),
    };

    TestBed.configureTestingModule({
      providers: [
        PlayerContextService,
        { provide: PlayerStore, useValue: mockPlayerStore },
        { provide: ALERT_SERVICE, useValue: mockAlertService },
        { provide: StorageStore, useValue: mockStorageStore },
        { provide: SettingsStore, useValue: mockSettingsStore },
        { provide: PlayerTimerManager, useValue: mockTimerManager },
        { provide: PLAYER_STORAGE, useValue: mockPlayerStorage },
      ],
    });

    service = TestBed.inject(PlayerContextService);
  });

  describe('initializePlayer with Settings Integration', () => {
    it('should apply default filter from settings when initializing player', () => {
      // Arrange
      const settingsStoreMock = mockSettingsStore as {
        settings: ReturnType<typeof vi.fn>;
      };
      settingsStoreMock.settings.mockReturnValue({
        playerSettings: {
          repeatModeOnStartup: false,
          playTimerEnabled: true,
          muteFastForward: false,
          muteRandomSeek: false,
          startupFilter: PlayerFilterType.Games, // Non-default filter
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
        appSettings: { setupCompleted: false },
      });

      // Act
      service.initializePlayer(deviceId);

      // Assert
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.Games,
        playTimerEnabled: true,
      });
    });

    it('should apply PlayerFilterType.All when settings are null', () => {
      // Arrange
      const settingsStoreMock = mockSettingsStore as {
        settings: ReturnType<typeof vi.fn>;
      };
      settingsStoreMock.settings.mockReturnValue(null);

      // Act
      service.initializePlayer(deviceId);

      // Assert
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.All,
        playTimerEnabled: false,
      });
    });

    it('should apply PlayerFilterType.All when playerSettings are undefined', () => {
      // Arrange
      const settingsStoreMock = mockSettingsStore as {
        settings: ReturnType<typeof vi.fn>;
      };
      settingsStoreMock.settings.mockReturnValue({
        connectionSettings: { autoConnectEnabled: false },
        playerSettings: undefined,
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
        appSettings: { setupCompleted: false },
      });

      // Act
      service.initializePlayer(deviceId);

      // Assert
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.All,
        playTimerEnabled: false,
      });
    });

    it('should apply Music filter when settings specify Music', () => {
      // Arrange
      const settingsStoreMock = mockSettingsStore as {
        settings: ReturnType<typeof vi.fn>;
      };
      settingsStoreMock.settings.mockReturnValue({
        connectionSettings: { autoConnectEnabled: false },
        playerSettings: {
          repeatModeOnStartup: false,
          playTimerEnabled: true,
          muteFastForward: false,
          muteRandomSeek: false,
          startupFilter: PlayerFilterType.Music,
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
        appSettings: { setupCompleted: false },
      });

      // Act
      service.initializePlayer(deviceId);

      // Assert
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.Music,
        playTimerEnabled: true,
      });
    });

    it('should apply Hex filter when settings specify Hex', () => {
      // Arrange
      const settingsStoreMock = mockSettingsStore as {
        settings: ReturnType<typeof vi.fn>;
      };
      settingsStoreMock.settings.mockReturnValue({
        connectionSettings: { autoConnectEnabled: false },
        playerSettings: {
          repeatModeOnStartup: false,
          playTimerEnabled: true,
          muteFastForward: false,
          muteRandomSeek: false,
          startupFilter: PlayerFilterType.Hex,
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
        appSettings: { setupCompleted: false },
      });

      // Act
      service.initializePlayer(deviceId);

      // Assert
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.Hex,
        playTimerEnabled: true,
      });
    });

    it('should apply Images filter when settings specify Images', () => {
      // Arrange
      const settingsStoreMock = mockSettingsStore as {
        settings: ReturnType<typeof vi.fn>;
      };
      settingsStoreMock.settings.mockReturnValue({
        connectionSettings: { autoConnectEnabled: false },
        playerSettings: {
          repeatModeOnStartup: false,
          playTimerEnabled: true,
          muteFastForward: false,
          muteRandomSeek: false,
          startupFilter: PlayerFilterType.Images,
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
        appSettings: { setupCompleted: false },
      });

      // Act
      service.initializePlayer(deviceId);

      // Assert
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.Images,
        playTimerEnabled: true,
      });
    });

    it('should initialize player with filter in single atomic operation', () => {
      // Act
      service.initializePlayer(deviceId);

      // Assert
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledTimes(1);
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.All,
        playTimerEnabled: true,
      });
    });

    it('should apply filter for each device independently', () => {
      // Arrange
      const device1 = 'device-1';
      const device2 = 'device-2';

      const settingsStoreMock = mockSettingsStore as {
        settings: ReturnType<typeof vi.fn>;
      };
      settingsStoreMock.settings.mockReturnValue({
        connectionSettings: { autoConnectEnabled: false },
        playerSettings: {
          repeatModeOnStartup: false,
          playTimerEnabled: true,
          muteFastForward: false,
          muteRandomSeek: false,
          startupFilter: PlayerFilterType.Games,
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
        appSettings: { setupCompleted: false },
      });

      // Act
      service.initializePlayer(device1);
      service.initializePlayer(device2);

      // Assert
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledTimes(2);
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId: device1,
        defaultFilter: PlayerFilterType.Games,
        playTimerEnabled: true,
      });
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId: device2,
        defaultFilter: PlayerFilterType.Games,
        playTimerEnabled: true,
      });
    });

    it('should NOT override user-modified filter when player already initialized', () => {
      // Arrange - Settings say "Games"
      const settingsStoreMock = mockSettingsStore as {
        settings: ReturnType<typeof vi.fn>;
      };
      settingsStoreMock.settings.mockReturnValue({
        connectionSettings: { autoConnectEnabled: false },
        playerSettings: {
          repeatModeOnStartup: false,
          playTimerEnabled: true,
          muteFastForward: false,
          muteRandomSeek: false,
          startupFilter: PlayerFilterType.Games,
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
        appSettings: { setupCompleted: false },
      });

      // Act - Initialize player (creates state with Games filter)
      service.initializePlayer(deviceId);

      // User manually changes filter to Music
      (mockPlayerStore.updateShuffleSettings as ReturnType<typeof vi.fn>).mockClear();
      mockPlayerStore.updateShuffleSettings({
        deviceId,
        shuffleSettings: { filter: PlayerFilterType.Music },
      });

      // Clear the initializePlayer mock to verify it's called again
      (mockPlayerStore.initializePlayer as ReturnType<typeof vi.fn>).mockClear();

      // Act - Initialize player again (simulating file launch)
      service.initializePlayer(deviceId);

      // Assert - initializePlayer was called but should not have reset the filter
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledTimes(1);
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.Games,
        playTimerEnabled: true,
      });

      // The key assertion: updateShuffleSettings should NOT have been called
      // because ensurePlayerState should have returned existing state without modifying it
      expect(mockPlayerStore.updateShuffleSettings).toHaveBeenCalledTimes(1); // Only the user's manual change
    });
  });

  describe('initializePlayer with Play Timer Settings', () => {
    beforeEach(() => {
      mockPlayerStore.updatePlayerTimer = vi.fn();
    });

    it('should enable play timer when playTimerEnabled is true in settings', () => {
      // Arrange
      const settingsStoreMock = mockSettingsStore as {
        settings: ReturnType<typeof vi.fn>;
      };
      settingsStoreMock.settings.mockReturnValue({
        connectionSettings: { autoConnectEnabled: false },
        playerSettings: {
          repeatModeOnStartup: false,
          playTimerEnabled: true, // Timer enabled in settings
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
        appSettings: { setupCompleted: false },
      });

      // Act
      service.initializePlayer(deviceId);

      // Assert
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.All,
        playTimerEnabled: true,
      });
    });

    it('should NOT enable play timer when playTimerEnabled is false in settings', () => {
      // Arrange
      const settingsStoreMock = mockSettingsStore as {
        settings: ReturnType<typeof vi.fn>;
      };
      settingsStoreMock.settings.mockReturnValue({
        connectionSettings: { autoConnectEnabled: false },
        playerSettings: {
          repeatModeOnStartup: false,
          playTimerEnabled: false, // Timer disabled in settings
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
        appSettings: { setupCompleted: false },
      });

      // Act
      service.initializePlayer(deviceId);

      // Assert
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.All,
        playTimerEnabled: false,
      });
    });

    it('should default to disabled when settings are null', () => {
      // Arrange
      const settingsStoreMock = mockSettingsStore as {
        settings: ReturnType<typeof vi.fn>;
      };
      settingsStoreMock.settings.mockReturnValue(null);

      // Act
      service.initializePlayer(deviceId);

      // Assert
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.All,
        playTimerEnabled: false,
      });
    });

    it('should default to disabled when playerSettings are undefined', () => {
      // Arrange
      const settingsStoreMock = mockSettingsStore as {
        settings: ReturnType<typeof vi.fn>;
      };
      settingsStoreMock.settings.mockReturnValue({
        connectionSettings: { autoConnectEnabled: false },
        playerSettings: undefined,
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
        appSettings: { setupCompleted: false },
      });

      // Act
      service.initializePlayer(deviceId);

      // Assert
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId,
        defaultFilter: PlayerFilterType.All,
        playTimerEnabled: false,
      });
    });

    it('should apply timer setting independently per device', () => {
      // Arrange
      const device1 = 'device-1';
      const device2 = 'device-2';

      const settingsStoreMock = mockSettingsStore as {
        settings: ReturnType<typeof vi.fn>;
      };
      settingsStoreMock.settings.mockReturnValue({
        connectionSettings: { autoConnectEnabled: false },
        playerSettings: {
          repeatModeOnStartup: false,
          playTimerEnabled: true,
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
        appSettings: { setupCompleted: false },
      });

      // Act
      service.initializePlayer(device1);
      service.initializePlayer(device2);

      // Assert
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledTimes(2);
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId: device1,
        defaultFilter: PlayerFilterType.All,
        playTimerEnabled: true,
      });
      expect(mockPlayerStore.initializePlayer).toHaveBeenCalledWith({
        deviceId: device2,
        defaultFilter: PlayerFilterType.All,
        playTimerEnabled: true,
      });
    });
  });
});
