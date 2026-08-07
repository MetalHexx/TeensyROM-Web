/* eslint-disable @typescript-eslint/no-unused-vars */
import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Signal, signal } from '@angular/core';
import { of, BehaviorSubject } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { PlayerDeviceContainerComponent } from './player-device-container.component';
import { PLAYER_CONTEXT, IPlayerContext, SettingsStore, PlayTimerConfig } from '@teensyrom-nx/application';
import { 
  LaunchMode, 
  PlayerStatus, 
  SETTINGS_SERVICE, 
  ISettingsService,
  STORAGE_SERVICE,
  IStorageService,
  CRT_STORAGE,
  ICrtStorage,
  CrtSettings,
  CustomCrtPreset,
  CustomPresetName
} from '@teensyrom-nx/domain';

/** Mock CRT storage for testing - stores nothing, returns null */
const mockCrtStorage: ICrtStorage = {
  save: (): void => {
    // Mock implementation - intentionally does nothing for testing
  },
  load: () => null,
  hasSavedSettings: () => false,
  clear: (): void => {
    // Mock implementation - intentionally does nothing for testing
  },
  saveCustomPreset: function (name: string, settings: CrtSettings): void {
    throw new Error('Function not implemented.');
  },
  updateCustomPreset: function (name: CustomPresetName, settings: CrtSettings): void {
    throw new Error('Function not implemented.');
  },
  loadCustomPresets: function (): CustomCrtPreset[] {
    throw new Error('Function not implemented.');
  },
  deleteCustomPreset: function (name: CustomPresetName): void {
    throw new Error('Function not implemented.');
  },
  renameCustomPreset: function (oldName: CustomPresetName, newName: string): void {
    throw new Error('Function not implemented.');
  },
  hasCustomPreset: function (name: CustomPresetName): boolean {
    throw new Error('Function not implemented.');
  }
};

describe('PlayerDeviceContainerComponent', () => {
  let component: PlayerDeviceContainerComponent;
  let fixture: ComponentFixture<PlayerDeviceContainerComponent>;
  let mockPlayerContext: IPlayerContext;
  let mockSettingsService: ISettingsService;
  let phoneBreakpointSubject: BehaviorSubject<BreakpointState>;
  let touchBreakpointSubject: BehaviorSubject<BreakpointState>;
  let currentFileSignal: ReturnType<typeof signal>;

  const createMockSettings = (enableVideo: boolean) => ({
    playerSettings: {
      repeatModeOnStartup: false,
      playTimerEnabled: false,
      muteFastForward: false,
      muteRandomSeek: false,
      startupFilter: 'All',
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
    knownDevices: [
      {
        deviceId: 'test-device',
        videoSettings: {
          enableVideo,
          videoDeviceId: '',
        },
        connectionSettings: {
          autoConnectEnabled: false,
        },
      },
    ],
  });

  beforeEach(async () => {
    // Create breakpoint mocks - default to desktop (not phone, not touch)
    phoneBreakpointSubject = new BehaviorSubject<BreakpointState>({
      matches: false,
      breakpoints: { '(max-width: 639px)': false }
    });

    touchBreakpointSubject = new BehaviorSubject<BreakpointState>({
      matches: false,
      breakpoints: { '(hover: none)': false }
    });

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
    currentFileSignal = signal(null);
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
      getCurrentFile: vi.fn().mockReturnValue(currentFileSignal.asReadonly()),
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
      getPlayHistory: vi.fn().mockReturnValue(() => ({ entries: [], currentIndex: -1 })),
      startListeningToPopState: vi.fn(),
      stopListeningToPopState: vi.fn(),
      updateCurrentFileFavoriteStatus: vi.fn(),
      getTimerState: vi.fn().mockReturnValue(signal(null).asReadonly()),
      isSlowLoading: vi.fn().mockReturnValue(signal(false).asReadonly()),

      getPlayTimerConfig: vi.fn().mockReturnValue(signal(null).asReadonly()),
      setCustomTimer: vi.fn(),
      isCurrentFileCompatible: vi.fn().mockReturnValue(signal(true).asReadonly()),
      getCurrentHistoryPosition: vi.fn().mockReturnValue(signal(0).asReadonly()),
      canNavigateBackwardInHistory: vi.fn().mockReturnValue(signal(false).asReadonly()),
      canNavigateForwardInHistory: vi.fn().mockReturnValue(signal(false).asReadonly()),
      clearHistory: vi.fn(),
      toggleHistoryView: vi.fn(),
      isHistoryViewVisible: vi.fn().mockReturnValue(signal(false).asReadonly()),
      navigateToHistoryPosition: vi.fn().mockResolvedValue(undefined),
    } satisfies IPlayerContext;

    await TestBed.configureTestingModule({
      imports: [PlayerDeviceContainerComponent],
      providers: [
        provideNoopAnimations(),
        { provide: PLAYER_CONTEXT, useValue: mockPlayerContext },
        { provide: SETTINGS_SERVICE, useValue: mockSettingsService },
        { provide: STORAGE_SERVICE, useValue: mockStorageService },
        { provide: CRT_STORAGE, useValue: mockCrtStorage },
        { provide: BreakpointObserver, useValue: {
          observe: (query: string) => {
            if (query === '(max-width: 639px)') {
              return phoneBreakpointSubject.asObservable();
            } else if (query === '(hover: none)') {
              return touchBreakpointSubject.asObservable();
            }
            return of({ matches: false, breakpoints: {} });
          }
        } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerDeviceContainerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('device', {
      deviceId: 'test-device',
      name: 'Test Device',
      status: 'connected',
      isConnected: true,
      isEnabled: true,
    });
    
    // Load settings into store (happens automatically via store initialization)
    const store = TestBed.inject(SettingsStore);
    await store.loadSettings();
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have isPhone signal that returns false by default', () => {
    expect(component['isPhone']).toBeDefined();
    expect(component['isPhone']()).toBe(false);
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

  describe('Phone Breakpoint Detection', () => {
    it('should return true when breakpoint matches phone size', () => {
      phoneBreakpointSubject.next({
        matches: true,
        breakpoints: { '(max-width: 639px)': true }
      });
      fixture.detectChanges();
      expect(component['isPhone']()).toBe(true);
    });

    it('should return false when breakpoint does not match', () => {
      phoneBreakpointSubject.next({
        matches: false,
        breakpoints: { '(max-width: 639px)': false }
      });
      fixture.detectChanges();
      expect(component['isPhone']()).toBe(false);
    });
  });

  describe('Pane Indicators', () => {
    it('should return empty array on desktop without video', () => {
      expect(component['paneIndicators']()).toEqual([]);
    });

    it('should return image+description+video indicators on desktop with video', async () => {
      await setEnableVideo(true);
      const indicators = component['paneIndicators']();
      expect(indicators).toEqual([
        { label: 'Show image', index: 0 },
        { label: 'Show description', index: 1 },
        { label: 'Show video', index: 2 },
      ]);
    });

    it('should return 3 panes on phone without video', () => {
      phoneBreakpointSubject.next({
        matches: true,
        breakpoints: { '(max-width: 639px)': true }
      });
      fixture.detectChanges();
      const indicators = component['paneIndicators']();
      expect(indicators).toEqual([
        { label: 'Show storage', index: 0 },
        { label: 'Show image', index: 1 },
        { label: 'Show description', index: 2 },
      ]);
    });

    it('should return 4 panes on phone with video', async () => {
      phoneBreakpointSubject.next({
        matches: true,
        breakpoints: { '(max-width: 639px)': true }
      });
      await setEnableVideo(true);
      const indicators = component['paneIndicators']();
      expect(indicators).toEqual([
        { label: 'Show storage', index: 0 },
        { label: 'Show image', index: 1 },
        { label: 'Show description', index: 2 },
        { label: 'Show video', index: 3 },
      ]);
    });
  });

  describe('hasStorageIndex Signal', () => {
    it('should return false when device is undefined', () => {
      fixture.componentRef.setInput('device', undefined);
      fixture.detectChanges();
      expect(component['hasStorageIndex']()).toBe(false);
    });

    it('should return false when device has no storage properties', () => {
      fixture.componentRef.setInput('device', {
        deviceId: 'test-device',
        name: 'Test',
        isConnected: true,
        isEnabled: true,
      });
      fixture.detectChanges();
      expect(component['hasStorageIndex']()).toBe(false);
    });

    it('should return true when sdStorage has indexExists', () => {
      fixture.componentRef.setInput('device', {
        deviceId: 'test-device',
        name: 'Test',
        isConnected: true,
        isEnabled: true,
        sdStorage: { indexExists: true, available: true },
        usbStorage: { indexExists: false, available: false },
      });
      fixture.detectChanges();
      expect(component['hasStorageIndex']()).toBe(true);
    });

    it('should return true when usbStorage has indexExists', () => {
      fixture.componentRef.setInput('device', {
        deviceId: 'test-device',
        name: 'Test',
        isConnected: true,
        isEnabled: true,
        sdStorage: { indexExists: false, available: false },
        usbStorage: { indexExists: true, available: true },
      });
      fixture.detectChanges();
      expect(component['hasStorageIndex']()).toBe(true);
    });

    it('should return true when both storages have indexExists', () => {
      fixture.componentRef.setInput('device', {
        deviceId: 'test-device',
        name: 'Test',
        isConnected: true,
        isEnabled: true,
        sdStorage: { indexExists: true, available: true },
        usbStorage: { indexExists: true, available: true },
      });
      fixture.detectChanges();
      expect(component['hasStorageIndex']()).toBe(true);
    });

    it('should return false when both storages have indexExists false', () => {
      fixture.componentRef.setInput('device', {
        deviceId: 'test-device',
        name: 'Test',
        isConnected: true,
        isEnabled: true,
        sdStorage: { indexExists: false, available: true },
        usbStorage: { indexExists: false, available: true },
      });
      fixture.detectChanges();
      expect(component['hasStorageIndex']()).toBe(false);
    });
  });

  describe('Always-Visible Toolbars', () => {
    it('should render combined-toolbar when no file is launched (desktop)', () => {
      // No file is launched (default state)
      const toolbar = fixture.nativeElement.querySelector('.combined-toolbar');
      expect(toolbar).toBeTruthy();
    });

    it('should render player-toolbar when no file is launched (desktop)', () => {
      const toolbar = fixture.nativeElement.querySelector('lib-player-toolbar');
      expect(toolbar).toBeTruthy();
    });

    it('should render filter-toolbar when no file is launched (desktop)', () => {
      const toolbar = fixture.nativeElement.querySelector('lib-filter-toolbar');
      expect(toolbar).toBeTruthy();
    });

    it('should pass disabled=true to player-toolbar when no file is launched', () => {
      const toolbar = fixture.debugElement.query(
        (el) => el.name === 'lib-player-toolbar'
      );
      expect(toolbar).toBeTruthy();
      expect(toolbar.componentInstance.disabled()).toBe(true);
    });

    it('should pass disabled=false to player-toolbar when a file is launched', () => {
      // Update the writable signal to simulate a file being launched
      currentFileSignal.set({ file: { name: 'test.sid', path: '/test.sid', images: [] } });
      fixture.detectChanges();

      const toolbar = fixture.debugElement.query(
        (el) => el.name === 'lib-player-toolbar'
      );
      expect(toolbar).toBeTruthy();
      expect(toolbar.componentInstance.disabled()).toBe(false);
    });

    it('should not disable filter-toolbar when no storage is indexed', () => {
      // Device has no storage index (default test device) — filter-toolbar
      // is no longer gated on index state, it should stay enabled.
      const toolbar = fixture.debugElement.query(
        (el) => el.name === 'lib-filter-toolbar'
      );
      expect(toolbar).toBeTruthy();
      expect(toolbar.componentInstance.disabled()).toBe(false);
    });

    it('should pass disabled=false to filter-toolbar when storage is indexed', () => {
      fixture.componentRef.setInput('device', {
        deviceId: 'test-device',
        name: 'Test Device',
        isConnected: true,
        isEnabled: true,
        sdStorage: { indexExists: true, available: true },
        usbStorage: { indexExists: false, available: false },
      });
      fixture.detectChanges();

      const toolbar = fixture.debugElement.query(
        (el) => el.name === 'lib-filter-toolbar'
      );
      expect(toolbar).toBeTruthy();
      expect(toolbar.componentInstance.disabled()).toBe(false);
    });

    it('should pass disabled=false to filter-toolbar when storage is indexed even with no file launched', () => {
      // No file launched, but storage is indexed
      fixture.componentRef.setInput('device', {
        deviceId: 'test-device',
        name: 'Test Device',
        isConnected: true,
        isEnabled: true,
        sdStorage: { indexExists: true, available: true },
      });
      fixture.detectChanges();

      const toolbar = fixture.debugElement.query(
        (el) => el.name === 'lib-filter-toolbar'
      );
      expect(toolbar).toBeTruthy();
      expect(toolbar.componentInstance.disabled()).toBe(false);
      // Player toolbar should still be disabled (no file launched)
      const playerToolbar = fixture.debugElement.query(
        (el) => el.name === 'lib-player-toolbar'
      );
      expect(playerToolbar.componentInstance.disabled()).toBe(true);
    });

    it('should render phone toolbars when on phone layout', () => {
      phoneBreakpointSubject.next({
        matches: true,
        breakpoints: { '(max-width: 639px)': true }
      });
      fixture.detectChanges();

      const miniToolbar = fixture.nativeElement.querySelector('lib-player-toolbar-mini');
      expect(miniToolbar).toBeTruthy();
    });
  });

  describe('Empty-State Messaging', () => {
    it('should render empty-state-message with sd_storage icon when storage is not indexed', () => {
      // Default device has no storage index
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('lib-empty-state-message');
      expect(emptyState).toBeTruthy();
      expect(component['emptyStateIcon']()).toBe('sd_storage');
      expect(component['emptyStateTitle']()).toBe('Index Your Storage');
    });

    it('should render empty-state-message with play_circle icon when storage is indexed but no file launched', () => {
      fixture.componentRef.setInput('device', {
        deviceId: 'test-device',
        name: 'Test Device',
        isConnected: true,
        isEnabled: true,
        sdStorage: { indexExists: true, available: true },
      });
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('lib-empty-state-message');
      expect(emptyState).toBeTruthy();
      expect(component['emptyStateIcon']()).toBe('play_circle');
      expect(component['emptyStateTitle']()).toBe('Ready to Play');
    });

    it('should render lib-file-description when a file is launched (not empty-state-message)', () => {
      currentFileSignal.set({ file: { name: 'test.sid', path: '/test.sid', images: [] } });
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('lib-empty-state-message');
      expect(emptyState).toBeNull();

      const fileDescription = fixture.nativeElement.querySelector('lib-file-description');
      expect(fileDescription).toBeTruthy();
    });

    it('should hide file-description-mini when no file is launched on phone', () => {
      phoneBreakpointSubject.next({
        matches: true,
        breakpoints: { '(max-width: 639px)': true }
      });
      fixture.detectChanges();

      const mini = fixture.nativeElement.querySelector('lib-file-description-mini');
      expect(mini).toBeNull();
    });

    it('should show file-description-mini on phone when a file is launched', () => {
      phoneBreakpointSubject.next({
        matches: true,
        breakpoints: { '(max-width: 639px)': true }
      });
      currentFileSignal.set({ file: { name: 'test.sid', path: '/test.sid', images: [] } });
      fixture.detectChanges();

      const mini = fixture.nativeElement.querySelector('lib-file-description-mini');
      expect(mini).toBeTruthy();
    });
  });
});
