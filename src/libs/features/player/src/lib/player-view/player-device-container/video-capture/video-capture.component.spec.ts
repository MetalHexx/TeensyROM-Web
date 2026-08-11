import { signal } from '@angular/core';
import { vi } from 'vitest';
import { MatDialog } from '@angular/material/dialog';
import { SettingsStore } from '@teensyrom-nx/application';
import { CRT_STORAGE, ICrtStorage, CrtSettings, CustomCrtPreset, CustomPresetName } from '@teensyrom-nx/domain';
import { CRT_PRESET_KEYS } from '@teensyrom-nx/ui/components';
import { renderPlayerComponent } from '../../../../testing/render-player-component';
import { VideoCaptureComponent } from './video-capture.component';

const customPresetSettings: CrtSettings = {
  scanlineIntensity: 0.7,
  scanlineSize: 3,
  vignetteStrength: 1.8,
  screenCurvature: 0,
  contrast: 1.3,
  brightness: 1.7,
  saturation: 1.5,
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
    name: 'custom-arcade-setup' as CustomPresetName,
    settings: customPresetSettings,
    createdAt: '2025-12-07T10:00:00.000Z',
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

const originalMediaDevices = navigator.mediaDevices;

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: originalMediaDevices,
    configurable: true,
  });
});

function mockMediaDevices(devices: { deviceId: string; label: string }[]) {
  const mockStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;

  const enumerateDevices = vi.fn().mockResolvedValue(
    devices.map((d) => ({ deviceId: d.deviceId, label: d.label, kind: 'videoinput' as MediaDeviceKind, groupId: '', toJSON: () => ({}) }))
  );
  const getUserMedia = vi.fn().mockResolvedValue(mockStream);

  Object.defineProperty(navigator, 'mediaDevices', {
    value: { enumerateDevices, getUserMedia },
    configurable: true,
  });

  return { enumerateDevices, getUserMedia };
}

function render(devices: { deviceId: string; label: string }[], crtStorage: ICrtStorage = createMockCrtStorage()) {
  const mediaDevices = mockMediaDevices(devices);
  const settingsStore = {
    videoDeviceIdForDevice: vi.fn().mockReturnValue(signal('').asReadonly()),
    updateDeviceVideoDeviceId: vi.fn(),
  };

  const result = renderPlayerComponent(VideoCaptureComponent, {
    inputs: { deviceId: 'teensy-device-1' },
    providers: [
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: SettingsStore, useValue: settingsStore },
      { provide: CRT_STORAGE, useValue: crtStorage },
    ],
  });

  return { ...result, mediaDevices, settingsStore, crtStorage };
}

async function renderAndSettle(
  devices: { deviceId: string; label: string }[],
  crtStorage?: ICrtStorage
) {
  const rendered = render(devices, crtStorage);
  await rendered.fixture.whenStable();
  rendered.fixture.detectChanges();
  return rendered;
}

describe('VideoCaptureComponent', () => {
  it('creates', async () => {
    const { component } = await renderAndSettle([]);

    expect(component).toBeTruthy();
  });

  it('reflects the deviceId input', async () => {
    const { component } = await renderAndSettle([]);

    expect(component.deviceId()).toBe('teensy-device-1');
  });

  it('updates selectedDevice when onDeviceSelected is called', async () => {
    const { component } = await renderAndSettle([
      { deviceId: 'cam-123', label: 'Front Camera' },
      { deviceId: 'cam-456', label: 'Back Camera' },
    ]);

    component.onDeviceSelected('cam-456');

    expect(component.selectedDevice()).toBe('cam-456');
  });

  it('requests a media stream with an exact deviceId constraint when a device is selected', async () => {
    const { component, mediaDevices, fixture } = await renderAndSettle([
      { deviceId: 'cam-123', label: 'Front Camera' },
      { deviceId: 'cam-456', label: 'Back Camera' },
    ]);
    mediaDevices.getUserMedia.mockClear();

    component.onDeviceSelected('cam-456');
    await fixture.whenStable();

    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { deviceId: { exact: 'cam-456' } },
      audio: false,
    });
  });

  it('requests user media permission on init', async () => {
    const { mediaDevices } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }]);

    expect(mediaDevices.getUserMedia).toHaveBeenCalled();
  });

  it('enumerates devices after permission is granted', async () => {
    const { mediaDevices } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }]);

    expect(mediaDevices.enumerateDevices).toHaveBeenCalled();
  });

  it('hasDevices is false when no camera devices are available', async () => {
    const { component } = await renderAndSettle([]);

    expect(component.hasDevices()).toBe(false);
  });

  it('hasStream is false before any async operations complete', () => {
    const { component } = render([]);

    expect(component.hasStream()).toBe(false);
  });

  it('CRT effect is enabled by default', async () => {
    const { component } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }]);

    expect(component['isCrtEnabled']()).toBe(true);
  });

  it('toggleCrtEffect flips the enabled state', async () => {
    const { component } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }]);

    component.toggleCrtEffect();

    expect(component['isCrtEnabled']()).toBe(false);
  });

  it('toggleCrtControls flips the controls-panel visibility', async () => {
    const { component } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }]);

    expect(component['showCrtControls']()).toBe(false);
    component.toggleCrtControls();
    expect(component['showCrtControls']()).toBe(true);
  });

  it('onCrtSettingsChange updates crtSettings', async () => {
    const { component } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }]);

    component.onCrtSettingsChange(customPresetSettings);

    expect(component['crtSettings']()).toEqual(customPresetSettings);
  });

  it('uses the SMALL_VIDEO_WEBGL preset when no saved settings exist', async () => {
    const { component } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }]);

    const settings = component['crtSettings']();
    expect(settings.phosphorPattern).toBe('aperture-grille');
    expect(settings.bloomIntensity).toBe(0);
  });

  it('loads saved CRT settings when present', async () => {
    const savedSettings: CrtSettings = { ...customPresetSettings, screenCurvature: 5 };
    const crtStorage = createMockCrtStorage({ load: vi.fn(() => savedSettings) });

    const { component } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }], crtStorage);

    expect(component['crtSettings']()).toEqual(savedSettings);
  });

  it('uses the small/compact CRT config', async () => {
    const { component } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }]);

    expect(component.crtConfig.showScanlines).toBe(true);
    expect(component.crtConfig.showVignette).toBe(true);
    expect(component.crtConfig.showCurvature).toBe(false);
  });

  it('persists CRT settings under the video-compact storage key', async () => {
    const crtStorage = createMockCrtStorage();
    const { component } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }], crtStorage);
    vi.mocked(crtStorage.save).mockClear();

    component.onCrtSettingsChange(customPresetSettings);

    expect(crtStorage.save).toHaveBeenCalledWith('teensy-device-1', 'video-compact', customPresetSettings);
  });

  it('applies a built-in preset', async () => {
    const { component } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }]);

    component.onCrtPresetSelected(CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL);

    expect(component['crtSettings']().phosphorPattern).toBe('aperture-grille');
  });

  it('applies a custom preset', async () => {
    const crtStorage = createMockCrtStorage({ loadCustomPresets: vi.fn().mockReturnValue(mockCustomPresets) });
    const { component } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }], crtStorage);

    component.onCrtPresetSelected('custom-arcade-setup' as CustomPresetName);

    const settings = component['crtSettings']();
    expect(settings.scanlineIntensity).toBe(0.7);
    expect(settings.scanlineSize).toBe(3);
    expect(settings.vignetteStrength).toBe(1.8);
  });

  it('persists a selected custom preset to storage', async () => {
    const crtStorage = createMockCrtStorage({ loadCustomPresets: vi.fn().mockReturnValue(mockCustomPresets) });
    const { component } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }], crtStorage);
    vi.mocked(crtStorage.save).mockClear();

    component.onCrtPresetSelected('custom-arcade-setup' as CustomPresetName);

    expect(crtStorage.save).toHaveBeenCalledWith(
      'teensy-device-1',
      'video-compact',
      expect.objectContaining({ scanlineIntensity: 0.7, scanlineSize: 3 })
    );
  });

  it('leaves settings unchanged and warns when a custom preset is not found', async () => {
    const crtStorage = createMockCrtStorage({ loadCustomPresets: vi.fn().mockReturnValue([]) });
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { /* intentionally empty */ });
    const { component } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }], crtStorage);
    const originalSettings = component['crtSettings']();

    component.onCrtPresetSelected('custom-nonexistent' as CustomPresetName);

    expect(consoleWarnSpy).toHaveBeenCalledWith('[VideoCaptureComponent] Custom preset not found: custom-nonexistent');
    expect(component['crtSettings']()).toEqual(originalSettings);

    consoleWarnSpy.mockRestore();
  });

  it('handles an empty custom presets array gracefully', async () => {
    const crtStorage = createMockCrtStorage({ loadCustomPresets: vi.fn().mockReturnValue([]) });
    const { component } = await renderAndSettle([{ deviceId: 'cam-123', label: 'Front Camera' }], crtStorage);
    const originalSettings = component['crtSettings']();

    expect(() => component.onCrtPresetSelected('custom-test' as CustomPresetName)).not.toThrow();

    expect(component['crtSettings']()).toEqual(originalSettings);
  });
});
