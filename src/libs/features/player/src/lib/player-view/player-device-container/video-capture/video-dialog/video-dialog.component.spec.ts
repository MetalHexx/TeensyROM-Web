import { signal } from '@angular/core';
import { vi } from 'vitest';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { SettingsStore, AudioStore } from '@teensyrom-nx/application';
import { STORAGE_SERVICE, CRT_STORAGE, ICrtStorage, CrtSettings, CustomCrtPreset, CustomPresetName } from '@teensyrom-nx/domain';
import { createMockStorageService } from '@teensyrom-nx/testing/fixtures';
import {
  ContentOverlayContainerComponent,
  CRT_CONFIGS,
  CRT_PRESETS,
  CRT_PRESET_KEYS,
  DEFAULT_CRT_SETTINGS,
  VideoControlsToolbarComponent,
} from '@teensyrom-nx/ui/components';
import { renderPlayerComponent } from '../../../../../testing/render-player-component';
import { VideoDialogComponent, VideoDialogData } from './video-dialog.component';

// jsdom doesn't implement playback; lib-video-stream calls videoEl.play().catch(...) on every
// stream assignment, which throws on jsdom's unimplemented play() without this stub.
HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
HTMLMediaElement.prototype.pause = vi.fn();

const customPresetSettings: CrtSettings = {
  scanlineIntensity: 0.6,
  scanlineSize: 2.5,
  vignetteStrength: 1.4,
  screenCurvature: 115,
  contrast: 1.2,
  brightness: 1.4,
  saturation: 1.2,
  hue: 0,
  phosphorPattern: 'none',
  phosphorIntensity: 0,
  bloomIntensity: 0.3,
  barrelDistortion: 0,
  chromaticAberration: 0,
  monochromePhosphor: 'none',
  autoCropBlackBars: false,
  videoStandard: 'PAL',
  videoMode: 'auto',
};

const mockCustomPresets: CustomCrtPreset[] = [
  {
    name: 'custom-dialog-preset' as CustomPresetName,
    settings: customPresetSettings,
    createdAt: '2025-12-07T12:00:00.000Z',
  },
];

function createMockCrtStorage(overrides: Partial<ICrtStorage> = {}): ICrtStorage {
  return {
    save: vi.fn(),
    load: vi.fn(() => null),
    hasSavedSettings: vi.fn(() => false),
    clear: vi.fn(),
    loadCustomPresets: vi.fn().mockReturnValue([]),
    saveCustomPreset: vi.fn(),
    updateCustomPreset: vi.fn(),
    deleteCustomPreset: vi.fn(),
    renameCustomPreset: vi.fn(),
    hasCustomPreset: vi.fn().mockReturnValue(false),
    ...overrides,
  };
}

function render(crtStorage: ICrtStorage = createMockCrtStorage()) {
  const mockStream = {
    getTracks: () => [],
    getVideoTracks: () => [],
    getAudioTracks: () => [],
  } as unknown as MediaStream;

  const dialogData: VideoDialogData = {
    stream: mockStream,
    deviceLabel: 'Test Camera',
    deviceId: 'test-device-123',
    devices: [
      { deviceId: 'test-device-123', label: 'Test Camera' },
      { deviceId: 'test-device-456', label: 'Backup Camera' },
    ],
    selectedDeviceId: 'test-device-123',
  };

  const dialogRef = { close: vi.fn() } as unknown as MatDialogRef<VideoDialogComponent>;

  const result = renderPlayerComponent(VideoDialogComponent, {
    // The template calls `overlayContainer.isFullscreen()` directly on the #overlayContainer
    // template-ref variable, so ContentOverlayContainerComponent must be real for the template
    // to render at all. The settings (tune) button assertions read the toolbar's own internal
    // template, so VideoControlsToolbarComponent is real too. Neither has WebGL/canvas children
    // of its own, so this doesn't drag in the CRT/WebGL subtree that caused the flake under
    // stubChildren: false.
    realChildren: [ContentOverlayContainerComponent, VideoControlsToolbarComponent],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: dialogData },
      { provide: STORAGE_SERVICE, useValue: createMockStorageService() },
      { provide: CRT_STORAGE, useValue: crtStorage },
      {
        provide: SettingsStore,
        useValue: { enableAudioStreamForDevice: vi.fn().mockReturnValue(signal(false).asReadonly()) },
      },
      {
        provide: AudioStore,
        useValue: {
          isMuted: signal(false),
          masterVolume: signal(0.75),
          toggleMute: vi.fn(),
          setMasterVolume: vi.fn(),
        },
      },
    ],
  });

  return { ...result, dialogRef, dialogData, crtStorage };
}

describe('VideoDialogComponent', () => {
  it('creates', () => {
    const { component } = render();

    expect(component).toBeTruthy();
  });

  it('has CRT enabled by default', () => {
    const { component } = render();

    expect(component['isCrtEnabled']()).toBe(true);
  });

  it('has CRT controls hidden by default', () => {
    const { component } = render();

    expect(component['showCrtControls']()).toBe(false);
  });

  it('uses the large CRT config', () => {
    const { component } = render();

    expect(component['crtConfig']).toEqual(CRT_CONFIGS.large);
  });

  it('uses the LARGE_VIDEO_WEBGL preset when no saved settings exist', () => {
    const { component } = render();

    expect(component['crtSettings']()).toEqual(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL]);
  });

  it('receives the stream from dialog data', () => {
    const { component, dialogData } = render();

    expect(component.data.stream).toBe(dialogData.stream);
  });

  it('receives the deviceLabel from dialog data', () => {
    const { component } = render();

    expect(component.data.deviceLabel).toBe('Test Camera');
  });

  it('receives the deviceId from dialog data', () => {
    const { component } = render();

    expect(component.data.deviceId).toBe('test-device-123');
  });

  it('closes the dialog when onClose is called', () => {
    const { component, dialogRef } = render();

    component.onClose();

    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('renders the close button', () => {
    const { fixture } = render();

    expect(fixture.nativeElement.querySelector('lib-icon-button[icon="close"]')).toBeTruthy();
  });

  it('round-trips the CRT enabled state', () => {
    const { component } = render();

    component.toggleCrtEffect();
    expect(component['isCrtEnabled']()).toBe(false);
    component.toggleCrtEffect();
    expect(component['isCrtEnabled']()).toBe(true);
  });

  it('renders the video-controls-toolbar housing the CRT toggle', () => {
    const { fixture } = render();

    expect(fixture.nativeElement.querySelector('lib-video-controls-toolbar')).toBeTruthy();
  });

  it('round-trips the CRT controls panel visibility', () => {
    const { component } = render();

    component.toggleCrtControls();
    expect(component['showCrtControls']()).toBe(true);
    component.toggleCrtControls();
    expect(component['showCrtControls']()).toBe(false);
  });

  it('renders the settings button when CRT is enabled', () => {
    const { fixture } = render();

    expect(fixture.nativeElement.querySelector('lib-icon-button[icon="tune"]')).toBeTruthy();
  });

  it('hides the settings button when CRT is disabled', () => {
    const { component, fixture } = render();

    component.toggleCrtEffect();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('lib-icon-button[icon="tune"]')).toBeFalsy();
  });

  it('renders the settings panel visually hidden by default', () => {
    const { fixture } = render();

    const settingsPanel = fixture.nativeElement.querySelector('lib-crt-settings-panel');
    expect(settingsPanel).toBeTruthy();
    expect(settingsPanel.classList.contains('panel-hidden')).toBe(true);
  });

  it('updates specific settings fields via onCrtSettingsChange', () => {
    const { component } = render();

    component.onCrtSettingsChange({ ...DEFAULT_CRT_SETTINGS, brightness: 2.0, contrast: 1.5 });

    expect(component['crtSettings']().brightness).toBe(2.0);
    expect(component['crtSettings']().contrast).toBe(1.5);
  });

  it('applies the LARGE_VIDEO_WEBGL preset via onCrtPresetSelected', () => {
    const { component } = render();

    component.onCrtPresetSelected(CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL);

    expect(component['crtSettings']()).toEqual(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL]);
  });

  it("applies a custom preset's settings correctly", () => {
    const crtStorage = createMockCrtStorage({ loadCustomPresets: vi.fn().mockReturnValue(mockCustomPresets) });
    const { component } = render(crtStorage);

    component.onCrtPresetSelected('custom-dialog-preset' as CustomPresetName);

    const settings = component['crtSettings']();
    expect(settings.scanlineIntensity).toBe(0.6);
    expect(settings.brightness).toBe(1.4);
  });

  it("persists a custom preset to storage under the dialog's key", () => {
    const crtStorage = createMockCrtStorage({ loadCustomPresets: vi.fn().mockReturnValue(mockCustomPresets) });
    const { component } = render(crtStorage);
    vi.mocked(crtStorage.save).mockClear();

    component.onCrtPresetSelected('custom-dialog-preset' as CustomPresetName);

    expect(crtStorage.save).toHaveBeenCalledWith(
      'test-device-123',
      'video-dialog',
      expect.objectContaining({ scanlineIntensity: 0.6 })
    );
  });

  it('leaves settings unchanged and warns when a custom preset is not found', () => {
    const crtStorage = createMockCrtStorage({ loadCustomPresets: vi.fn().mockReturnValue([]) });
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { /* intentionally empty */ });
    const { component } = render(crtStorage);
    const originalSettings = component['crtSettings']();

    component.onCrtPresetSelected('custom-nonexistent' as CustomPresetName);

    expect(consoleWarnSpy).toHaveBeenCalledWith('[VideoDialogComponent] Custom preset not found: custom-nonexistent');
    expect(component['crtSettings']()).toEqual(originalSettings);

    consoleWarnSpy.mockRestore();
  });

  it('renders the content-overlay-container', () => {
    const { fixture } = render();

    expect(fixture.nativeElement.querySelector('lib-content-overlay-container')).toBeTruthy();
  });

  it('renders the video stream element', () => {
    const { fixture } = render();

    expect(fixture.nativeElement.querySelector('lib-video-stream')).toBeTruthy();
  });

  it('houses the CRT wrapper in the content slot', () => {
    const { fixture } = render();

    expect(fixture.nativeElement.querySelector('lib-crt-effect-wrapper[content]')).toBeTruthy();
  });

  it('houses the filter toolbar in the topOverlay slot', () => {
    const { fixture } = render();

    expect(fixture.nativeElement.querySelector('lib-filter-toolbar[topOverlay]')).toBeTruthy();
  });

  it('houses the player toolbar in the bottomOverlay slot', () => {
    const { fixture } = render();

    expect(fixture.nativeElement.querySelector('lib-player-toolbar[bottomOverlay]')).toBeTruthy();
  });

  it('houses the video controls toolbar in the rightControls slot', () => {
    const { fixture } = render();

    expect(fixture.nativeElement.querySelector('lib-video-controls-toolbar[rightControls]')).toBeTruthy();
  });

  it('loads saved CRT settings when present', () => {
    const savedSettings: CrtSettings = { ...CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL], brightness: 2.0 };
    const crtStorage = createMockCrtStorage({ load: vi.fn(() => savedSettings) });

    const { component } = render(crtStorage);

    expect(component['crtSettings']()).toEqual(savedSettings);
    expect(component['crtSettings']().brightness).toBe(2.0);
  });

  it('persists CRT settings under the video-dialog storage key', () => {
    const crtStorage = createMockCrtStorage();
    const { component } = render(crtStorage);

    const newSettings = { ...DEFAULT_CRT_SETTINGS, brightness: 1.8 };
    component.onCrtSettingsChange(newSettings);

    expect(crtStorage.save).toHaveBeenCalledWith('test-device-123', 'video-dialog', newSettings);
  });
});
