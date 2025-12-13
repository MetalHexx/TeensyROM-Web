import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VideoDialogComponent, VideoDialogData } from './video-dialog.component';
import { CRT_CONFIGS, DEFAULT_CRT_SETTINGS, CRT_PRESETS, CRT_PRESET_KEYS } from '@teensyrom-nx/ui/components';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { PLAYER_CONTEXT, IPlayerContext } from '@teensyrom-nx/application';
import { STORAGE_SERVICE, PlayerStatus, LaunchMode, CRT_STORAGE, ICrtStorage, CustomCrtPreset, CustomPresetName } from '@teensyrom-nx/domain';

/** Mock custom presets for testing */
const mockCustomPresets: CustomCrtPreset[] = [
  {
    name: 'custom-dialog-preset' as CustomPresetName,
    settings: {
      scanlineIntensity: 0.6,
      scanlineSize: 2.5,
      vignetteStrength: 1.4,
      screenCurvature: 115,
      contrast: 1.2,
      brightness: 1.4,
      saturation: 1.2,
      hue: 0,
      renderMode: 'webgl',
      phosphorPattern: 'none',
      phosphorIntensity: 0,
      bloomEnabled: false,
      bloomIntensity: 0.3,
      bloomRadius: 3,
      barrelDistortion: 0,
      chromaticAberration: 0,
    },
    createdAt: '2025-12-07T12:00:00.000Z',
  },
];

/** Mock CRT storage for testing - stores nothing, returns null */
const mockCrtStorage: ICrtStorage = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  save: () => {},
  load: () => null,
  hasSavedSettings: () => false,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  clear: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  saveCustomPreset: () => {},
  loadCustomPresets: vi.fn().mockReturnValue([]),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  deleteCustomPreset: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  renameCustomPreset: () => {},
  hasCustomPreset: () => false,
};

// Mock HTMLMediaElement.play and pause for JSDOM environment
HTMLMediaElement.prototype.play = vi.fn().mockImplementation(function () {
  return Promise.resolve();
});
HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(function () {
  return undefined;
});

// Create a complete mock player context using Partial and casting
function createMockPlayerContext(): IPlayerContext {
  const mockSignal = <T>(value: T) => signal(value).asReadonly();

  return {
    initializePlayer: vi.fn(),
    removePlayer: vi.fn(),
    startListeningToPopState: vi.fn(),
    stopListeningToPopState: vi.fn(),
    launchFileWithContext: vi.fn().mockResolvedValue(undefined),
    launchRandomFile: vi.fn().mockResolvedValue(undefined),
    updateCurrentFileFavoriteStatus: vi.fn(),
    getCurrentFile: vi.fn().mockReturnValue(mockSignal(null)),
    getFileContext: vi.fn().mockReturnValue(mockSignal(null)),
    getPlayerStatus: vi.fn().mockReturnValue(mockSignal(PlayerStatus.Stopped)),
    getStatus: vi.fn().mockReturnValue(mockSignal(PlayerStatus.Stopped)),
    isLoading: vi.fn().mockReturnValue(mockSignal(false)),
    getError: vi.fn().mockReturnValue(mockSignal(null)),
    toggleShuffleMode: vi.fn(),
    setShuffleScope: vi.fn(),
    setFilterMode: vi.fn(),
    getLaunchMode: vi.fn().mockReturnValue(mockSignal(LaunchMode.Directory)),
    getShuffleSettings: vi.fn().mockReturnValue(mockSignal(null)),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    next: vi.fn().mockResolvedValue(undefined),
    previous: vi.fn().mockResolvedValue(undefined),
    getTimerState: vi.fn().mockReturnValue(mockSignal(null)),
    getPlayTimerConfig: vi.fn().mockReturnValue(mockSignal(null)),
    setCustomTimer: vi.fn(),
    isCurrentFileCompatible: vi.fn().mockReturnValue(mockSignal(true)),
    getPlayHistory: vi.fn().mockReturnValue(mockSignal(null)),
    getCurrentHistoryPosition: vi.fn().mockReturnValue(mockSignal(0)),
    canNavigateBackwardInHistory: vi.fn().mockReturnValue(mockSignal(false)),
    canNavigateForwardInHistory: vi.fn().mockReturnValue(mockSignal(false)),
    clearHistory: vi.fn(),
    toggleHistoryView: vi.fn(),
    isHistoryViewVisible: vi.fn().mockReturnValue(mockSignal(false)),
    navigateToHistoryPosition: vi.fn().mockResolvedValue(undefined),
  };
}

describe('VideoDialogComponent', () => {
  let component: VideoDialogComponent;
  let fixture: ComponentFixture<VideoDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockDialogData: VideoDialogData;

  beforeEach(async () => {
    // Create mock MediaStream
    const mockStream = {
      getTracks: () => [],
      getVideoTracks: () => [],
      getAudioTracks: () => [],
    } as unknown as MediaStream;

    mockDialogData = {
      stream: mockStream,
      deviceLabel: 'Test Camera',
      deviceId: 'test-device-123',
      devices: [
        { deviceId: 'test-device-123', label: 'Test Camera' },
        { deviceId: 'test-device-456', label: 'Backup Camera' },
      ],
      selectedDeviceId: 'test-device-123',
    };

    mockDialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [VideoDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        { provide: PLAYER_CONTEXT, useValue: createMockPlayerContext() },
        {
          provide: STORAGE_SERVICE,
          useValue: {
            getDirectory: vi.fn(),
          },
        },
        { provide: CRT_STORAGE, useValue: mockCrtStorage },
      ],
      // Use CUSTOM_ELEMENTS_SCHEMA for shallow testing to ignore child components
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoDialogComponent);
    component = fixture.componentInstance;
  });

  describe('Component Creation', () => {
    it('should create successfully', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should have CRT enabled by default', () => {
      fixture.detectChanges();
      expect(component['isCrtEnabled']()).toBe(true);
    });

    it('should have CRT controls hidden by default', () => {
      fixture.detectChanges();
      expect(component['showCrtControls']()).toBe(false);
    });

    it('should use CRT_CONFIGS.full for config', () => {
      fixture.detectChanges();
      expect(component['crtConfig']).toEqual(CRT_CONFIGS.full);
    });

    it('should have default CRT settings', () => {
      fixture.detectChanges();
      const settings = component['crtSettings']();
      expect(settings.scanlineIntensity).toBe(0.5);
      expect(settings.brightness).toBe(1.5);
      expect(settings.contrast).toBe(1.1);
    });
  });

  describe('Dialog Data', () => {
    it('should receive stream from dialog data', () => {
      fixture.detectChanges();
      expect(component.data.stream).toBe(mockDialogData.stream);
    });

    it('should receive deviceLabel from dialog data', () => {
      fixture.detectChanges();
      expect(component.data.deviceLabel).toBe('Test Camera');
    });

    it('should receive deviceId from dialog data', () => {
      fixture.detectChanges();
      expect(component.data.deviceId).toBe('test-device-123');
    });
  });

  describe('Close Functionality', () => {
    it('should close dialog when onClose is called', () => {
      fixture.detectChanges();
      component.onClose();
      expect(mockDialogRef.close).toHaveBeenCalled();
    });

    it('should render close button in template', () => {
      fixture.detectChanges();
      const closeButton = fixture.nativeElement.querySelector(
        'lib-icon-button[icon="close"]'
      );
      expect(closeButton).toBeTruthy();
    });
  });

  describe('CRT Toggle', () => {
    it('should toggle CRT enabled state', () => {
      fixture.detectChanges();
      expect(component['isCrtEnabled']()).toBe(true);

      component.toggleCrtEffect();
      expect(component['isCrtEnabled']()).toBe(false);

      component.toggleCrtEffect();
      expect(component['isCrtEnabled']()).toBe(true);
    });

    it('should render CRT toggle button', () => {
      fixture.detectChanges();
      // CRT toggle button is now inside lib-video-controls-toolbar
      const toolbar = fixture.nativeElement.querySelector(
        'lib-video-controls-toolbar'
      );
      expect(toolbar).toBeTruthy();
    });
  });

  describe('CRT Controls Panel', () => {
    it('should toggle CRT controls visibility', () => {
      fixture.detectChanges();
      expect(component['showCrtControls']()).toBe(false);

      component.toggleCrtControls();
      expect(component['showCrtControls']()).toBe(true);

      component.toggleCrtControls();
      expect(component['showCrtControls']()).toBe(false);
    });

    it('should render settings button when CRT is enabled', () => {
      fixture.detectChanges();
      const tuneButton = fixture.nativeElement.querySelector(
        'lib-icon-button[icon="tune"]'
      );
      expect(tuneButton).toBeTruthy();
    });

    it('should not render settings button when CRT is disabled', () => {
      fixture.detectChanges();
      component.toggleCrtEffect(); // Disable CRT
      fixture.detectChanges();

      const tuneButton = fixture.nativeElement.querySelector(
        'lib-icon-button[icon="tune"]'
      );
      expect(tuneButton).toBeFalsy();
    });

    it('should show CRT settings panel when controls are toggled on', () => {
      fixture.detectChanges();
      component.toggleCrtControls(); // Show panel
      fixture.detectChanges();

      const settingsPanel = fixture.nativeElement.querySelector(
        'lib-crt-settings-panel'
      );
      expect(settingsPanel).toBeTruthy();
    });

    it('should hide CRT settings panel when controls are toggled off', () => {
      fixture.detectChanges();
      // Panel should be rendered but hidden by default (CRT is enabled, controls are hidden)
      const settingsPanel = fixture.nativeElement.querySelector(
        'lib-crt-settings-panel'
      );
      expect(settingsPanel).toBeTruthy();
      expect(settingsPanel.classList.contains('panel-hidden')).toBe(true);
    });
  });

  describe('CRT Settings Changes', () => {
    it('should update settings when onCrtSettingsChange is called', () => {
      fixture.detectChanges();
      const newSettings = {
        ...DEFAULT_CRT_SETTINGS,
        brightness: 2.0,
        contrast: 1.5,
      };

      component.onCrtSettingsChange(newSettings);

      expect(component['crtSettings']().brightness).toBe(2.0);
      expect(component['crtSettings']().contrast).toBe(1.5);
    });

    it('should apply preset when onCrtPresetSelected is called', () => {
      fixture.detectChanges();

      component.onCrtPresetSelected(CRT_PRESET_KEYS.DIALOG_WEBGL);

      expect(component['crtSettings']()).toEqual(CRT_PRESETS[CRT_PRESET_KEYS.DIALOG_WEBGL]);
    });

    it('should apply full preset correctly', () => {
      fixture.detectChanges();

      component.onCrtPresetSelected(CRT_PRESET_KEYS.FULLSCREEN_WEBGL);

      expect(component['crtSettings']()).toEqual(CRT_PRESETS[CRT_PRESET_KEYS.FULLSCREEN_WEBGL]);
    });

    describe('custom preset selection', () => {
      it('should apply built-in preset settings correctly', () => {
        fixture.detectChanges();

        component.onCrtPresetSelected(CRT_PRESET_KEYS.DIALOG_CSS);
        
        const settings = component['crtSettings']();
        expect(settings.renderMode).toBe('css');
      });

      it('should apply custom preset settings correctly', () => {
        vi.mocked(mockCrtStorage.loadCustomPresets).mockReturnValue(mockCustomPresets);
        fixture.detectChanges();

        component.onCrtPresetSelected('custom-dialog-preset' as CustomPresetName);
        
        const settings = component['crtSettings']();
        expect(settings.scanlineIntensity).toBe(0.6);
        expect(settings.brightness).toBe(1.4);
      });

      it('should call loadCustomPresets when custom preset selected', () => {
        vi.mocked(mockCrtStorage.loadCustomPresets).mockReturnValue(mockCustomPresets);
        fixture.detectChanges();

        vi.mocked(mockCrtStorage.loadCustomPresets).mockClear();

        component.onCrtPresetSelected('custom-dialog-preset' as CustomPresetName);
        
        expect(mockCrtStorage.loadCustomPresets).toHaveBeenCalled();
      });

      it('should persist custom preset settings to storage', () => {
        vi.mocked(mockCrtStorage.loadCustomPresets).mockReturnValue(mockCustomPresets);
        const saveSpy = vi.spyOn(mockCrtStorage, 'save');
        fixture.detectChanges();

        saveSpy.mockClear();

        component.onCrtPresetSelected('custom-dialog-preset' as CustomPresetName);
        
        expect(saveSpy).toHaveBeenCalledWith(
          'test-device-123',
          'video-dialog',
          expect.objectContaining({
            scanlineIntensity: 0.6,
          })
        );
      });

      it('should log warning when custom preset not found', () => {
        vi.mocked(mockCrtStorage.loadCustomPresets).mockReturnValue([]);
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { /* intentionally empty */ });
        fixture.detectChanges();

        const originalSettings = component['crtSettings']();

        component.onCrtPresetSelected('custom-nonexistent' as CustomPresetName);
        
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[VideoDialogComponent] Custom preset not found: custom-nonexistent'
        );

        expect(component['crtSettings']()).toEqual(originalSettings);

        consoleWarnSpy.mockRestore();
      });

      it('should not change settings when custom preset not found', () => {
        vi.mocked(mockCrtStorage.loadCustomPresets).mockReturnValue([]);
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { /* intentionally empty */ });
        fixture.detectChanges();

        const customSettings = {
          ...DEFAULT_CRT_SETTINGS,
          brightness: 2.5,
        };
        component.onCrtSettingsChange(customSettings);

        component.onCrtPresetSelected('custom-missing' as CustomPresetName);
        
        expect(component['crtSettings']()).toEqual(customSettings);

        consoleWarnSpy.mockRestore();
      });
    });
  });

  describe('Fullscreen Toggle', () => {
    it('should have fullscreen toggle button', () => {
      fixture.detectChanges();
      // Fullscreen button is now inside lib-video-controls-toolbar
      const toolbar = fixture.nativeElement.querySelector('lib-video-controls-toolbar');
      expect(toolbar).toBeTruthy();
    });
  });

  describe('Composed Components', () => {
    it('should render lib-content-overlay-container', () => {
      fixture.detectChanges();
      const overlayContainer = fixture.nativeElement.querySelector(
        'lib-content-overlay-container'
      );
      expect(overlayContainer).toBeTruthy();
    });

    it('should render lib-crt-effect-wrapper', () => {
      fixture.detectChanges();
      const crtWrapper = fixture.nativeElement.querySelector(
        'lib-crt-effect-wrapper'
      );
      expect(crtWrapper).toBeTruthy();
    });

    it('should render lib-video-stream', () => {
      fixture.detectChanges();
      const videoStream = fixture.nativeElement.querySelector('lib-video-stream');
      expect(videoStream).toBeTruthy();
    });

    it('should render lib-video-controls-toolbar for right controls', () => {
      fixture.detectChanges();
      const toolbar = fixture.nativeElement.querySelector(
        'lib-video-controls-toolbar[rightControls]'
      );
      expect(toolbar).toBeTruthy();
    });
  });

  describe('Slot Architecture', () => {
    it('should have content slot with CRT wrapper', () => {
      fixture.detectChanges();
      const crtWrapper = fixture.nativeElement.querySelector(
        'lib-crt-effect-wrapper[content]'
      );
      expect(crtWrapper).toBeTruthy();
    });

    it('should have topOverlay slot with filter toolbar', () => {
      fixture.detectChanges();
      const filterToolbar = fixture.nativeElement.querySelector(
        'lib-filter-toolbar[topOverlay]'
      );
      expect(filterToolbar).toBeTruthy();
    });

    it('should have bottomOverlay slot with player toolbar', () => {
      fixture.detectChanges();
      const playerToolbar = fixture.nativeElement.querySelector(
        'lib-player-toolbar[bottomOverlay]'
      );
      expect(playerToolbar).toBeTruthy();
    });

    it('should have topRightCorner slot with close button', () => {
      fixture.detectChanges();
      const closeButton = fixture.nativeElement.querySelector(
        'lib-icon-button[topRightCorner]'
      );
      expect(closeButton).toBeTruthy();
    });

    it('should have rightControls slot with video controls toolbar', () => {
      fixture.detectChanges();
      const rightControls = fixture.nativeElement.querySelector(
        'lib-video-controls-toolbar[rightControls]'
      );
      expect(rightControls).toBeTruthy();
    });
  });

  describe('Unified Config Model', () => {
    it('should pass same config to CRT wrapper and settings panel', () => {
      fixture.detectChanges();
      component.toggleCrtControls(); // Show panel
      fixture.detectChanges();

      const crtWrapper = fixture.nativeElement.querySelector(
        'lib-crt-effect-wrapper'
      );
      const settingsPanel = fixture.nativeElement.querySelector(
        'lib-crt-settings-panel'
      );

      // Both should exist when panel is shown
      expect(crtWrapper).toBeTruthy();
      expect(settingsPanel).toBeTruthy();

      // Component should use CRT_CONFIGS.full for both
      expect(component['crtConfig']).toEqual(CRT_CONFIGS.full);
    });
  });
});


