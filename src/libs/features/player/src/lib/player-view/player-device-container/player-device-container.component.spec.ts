import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PlayerDeviceContainerComponent } from './player-device-container.component';
import { PLAYER_CONTEXT, IPlayerContext, SettingsStore } from '@teensyrom-nx/application';
import { 
  LaunchMode, 
  PlayerStatus, 
  SETTINGS_SERVICE, 
  ISettingsService,
  STORAGE_SERVICE,
  IStorageService
} from '@teensyrom-nx/domain';

describe('PlayerDeviceContainerComponent', () => {
  let component: PlayerDeviceContainerComponent;
  let fixture: ComponentFixture<PlayerDeviceContainerComponent>;
  let mockPlayerContext: IPlayerContext;
  let mockSettingsService: ISettingsService;

  const createMockSettings = (enableVideo: boolean) => ({
    connectionSettings: {
      connectionType: 'Serial',
      autoConnectEnabled: false,
    },
    playerSettings: {
      repeatModeOnStartup: false,
      playTimerEnabled: false,
      muteFastForward: false,
      muteRandomSeek: false,
      startupFilter: 'All',
      startupLaunchEnabled: false,
      startupLaunchRandom: false,
    },
    videoSettings: {
      enableVideo,
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
        nameWeight: 1,
        titleWeight: 1,
        creatorWeight: 1,
        releaseInfoWeight: 1,
        descriptionWeight: 1,
      },
      stopWords: [],
      bannedDirectories: [],
      bannedFiles: [],
    },
    appSettings: {
      setupCompleted: false,
    },
  });

  beforeEach(async () => {
    // Create a mock settings service - default to enableVideo: false
    mockSettingsService = {
      getSettings: vi.fn().mockReturnValue(of(createMockSettings(false))),
      saveSettings: vi.fn().mockReturnValue(of(undefined)),
    };

    // Create a mock storage service (required by SettingsStore's storage actions)
    const mockStorageService: Partial<IStorageService> = {
      // Add minimal mocks if needed for other tests
    };

    // Create a mock player context
    mockPlayerContext = {
      initializePlayer: vi.fn(),
      removePlayer: vi.fn(),
      launchFileWithContext: vi.fn().mockResolvedValue(undefined),
      launchRandomFile: vi.fn().mockResolvedValue(undefined),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      next: vi.fn().mockResolvedValue(undefined),
      previous: vi.fn().mockResolvedValue(undefined),
      getCurrentFile: vi.fn().mockReturnValue(signal(null).asReadonly()),
      getFileContext: vi.fn().mockReturnValue(signal(null).asReadonly()),
      getPlayerStatus: vi.fn().mockReturnValue(signal(PlayerStatus.Stopped).asReadonly()),
      getStatus: vi.fn().mockReturnValue(signal(PlayerStatus.Stopped).asReadonly()),
      isLoading: vi.fn().mockReturnValue(signal(false).asReadonly()),
      getError: vi.fn().mockReturnValue(signal(null).asReadonly()),
      toggleShuffleMode: vi.fn(),
      setShuffleScope: vi.fn(),
      setFilterMode: vi.fn(),
      getLaunchMode: vi.fn().mockReturnValue(signal(LaunchMode.Directory).asReadonly()),
      getShuffleSettings: vi.fn().mockReturnValue(signal(null).asReadonly()),
      isHistoryViewVisible: vi.fn().mockReturnValue(() => signal(false).asReadonly()),
      getPlayHistory: vi.fn().mockReturnValue(() => ({ entries: [], currentIndex: -1 })),
    } satisfies IPlayerContext;

    await TestBed.configureTestingModule({
      imports: [PlayerDeviceContainerComponent],
      providers: [
        provideNoopAnimations(),
        { provide: PLAYER_CONTEXT, useValue: mockPlayerContext },
        { provide: SETTINGS_SERVICE, useValue: mockSettingsService },
        { provide: STORAGE_SERVICE, useValue: mockStorageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerDeviceContainerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('device', {
      deviceId: 'test-device',
      name: 'Test Device',
      status: 'connected',
      isConnected: true,
    });
    
    // Load settings into store (happens automatically via store initialization)
    const store = TestBed.inject(SettingsStore);
    await store.loadSettings();
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * Helper to simulate settings change by updating mock and reloading store
   */
  async function setEnableVideo(enabled: boolean): Promise<void> {
    mockSettingsService.getSettings = vi.fn().mockReturnValue(of(createMockSettings(enabled)));
    const store = TestBed.inject(SettingsStore);
    await store.loadSettings();
    fixture.detectChanges();
  }

  describe('EnableVideo Signal', () => {
    it('should have enableVideo signal defined', () => {
      expect(component.enableVideo).toBeDefined();
      expect(typeof component.enableVideo).toBe('function');
    });

    it('should return false when settings not loaded (default)', () => {
      expect(component.enableVideo()).toBe(false);
    });

    it('should return true when enableVideo is true in settings', async () => {
      await setEnableVideo(true);
      expect(component.enableVideo()).toBe(true);
    });

    it('should return false when enableVideo is false in settings', async () => {
      await setEnableVideo(false);
      expect(component.enableVideo()).toBe(false);
    });

    it('should reactively update when settings change', async () => {
      expect(component.enableVideo()).toBe(false);

      await setEnableVideo(true);
      expect(component.enableVideo()).toBe(true);

      await setEnableVideo(false);
      expect(component.enableVideo()).toBe(false);
    });
  });

  describe('Conditional Rendering', () => {
    it('should render video-capture when enableVideo is true', async () => {
      await setEnableVideo(true);

      const videoCapture = fixture.nativeElement.querySelector('lib-video-capture');
      expect(videoCapture).toBeTruthy();
    });

    it('should not render video-capture when enableVideo is false', () => {
      const videoCapture = fixture.nativeElement.querySelector('lib-video-capture');
      expect(videoCapture).toBeNull();
    });

    it('should add video-capture to DOM when toggling from false to true', async () => {
      let videoCapture = fixture.nativeElement.querySelector('lib-video-capture');
      expect(videoCapture).toBeNull();

      await setEnableVideo(true);
      videoCapture = fixture.nativeElement.querySelector('lib-video-capture');
      expect(videoCapture).toBeTruthy();
    });

    it('should remove video-capture from DOM when toggling from true to false', async () => {
      await setEnableVideo(true);
      let videoCapture = fixture.nativeElement.querySelector('lib-video-capture');
      expect(videoCapture).toBeTruthy();

      await setEnableVideo(false);
      videoCapture = fixture.nativeElement.querySelector('lib-video-capture');
      expect(videoCapture).toBeNull();
    });

    it('should still render lib-file-image when video-capture is hidden', () => {
      const fileImage = fixture.nativeElement.querySelector('lib-file-image');
      expect(fileImage).toBeTruthy();
    });

    it('should still render lib-file-other when video-capture is hidden', () => {
      const fileOther = fixture.nativeElement.querySelector('lib-file-other');
      expect(fileOther).toBeTruthy();
    });

    it('should maintain device-header layout when video-capture is hidden', () => {
      const deviceHeader = fixture.nativeElement.querySelector('.device-header');
      expect(deviceHeader).toBeTruthy();
      expect(deviceHeader.querySelector('lib-file-image')).toBeTruthy();
      expect(deviceHeader.querySelector('lib-file-other')).toBeTruthy();
    });
  });

  describe('Store Integration', () => {
    it('should inject SettingsStore successfully', () => {
      const store = TestBed.inject(SettingsStore);
      expect(store).toBeDefined();
    });

    it('should have enableVideo signal that reflects store value', async () => {
      await setEnableVideo(true);
      expect(component.enableVideo()).toBe(true);

      await setEnableVideo(false);
      expect(component.enableVideo()).toBe(false);
    });

    it('should handle rapid toggling without errors', async () => {
      let error: Error | null = null;
      try {
        for (let i = 0; i < 5; i++) {
          await setEnableVideo(i % 2 === 0);
        }
      } catch (e) {
        error = e as Error;
      }
      expect(error).toBeNull();
    });

  });
});
