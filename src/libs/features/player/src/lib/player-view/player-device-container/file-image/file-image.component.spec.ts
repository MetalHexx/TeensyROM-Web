import { signal } from '@angular/core';
import { vi } from 'vitest';
import { DeviceStore } from '@teensyrom-nx/application';
import {
  CRT_STORAGE,
  Device,
  DeviceVideoStandard,
  ICrtStorage,
  CrtSettings,
  CustomCrtPreset,
  CustomPresetName,
} from '@teensyrom-nx/domain';
import { CRT_PRESET_KEYS } from '@teensyrom-nx/ui/components';
import { renderPlayerComponent } from '../../../../testing/render-player-component';
import { FileImageComponent } from './file-image.component';

const customPresetSettings: CrtSettings = {
  scanlineIntensity: 0.5,
  scanlineSize: 1.5,
  vignetteStrength: 1.1,
  screenCurvature: 16,
  contrast: 1.1,
  brightness: 0.95,
  saturation: 1.1,
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
    name: 'custom-image-preset' as CustomPresetName,
    settings: customPresetSettings,
    createdAt: '2025-12-07T13:00:00.000Z',
  },
];

function createMockCrtStorage(overrides: Partial<ICrtStorage> = {}): ICrtStorage {
  return {
    save: vi.fn(),
    load: vi.fn(() => null),
    hasSavedSettings: vi.fn(() => false),
    clear: vi.fn(),
    clearDevice: vi.fn(),
    loadCustomPresets: vi.fn().mockReturnValue([]),
    saveCustomPreset: vi.fn(),
    updateCustomPreset: vi.fn(),
    deleteCustomPreset: vi.fn(),
    renameCustomPreset: vi.fn(),
    hasCustomPreset: vi.fn().mockReturnValue(false),
    ...overrides,
  };
}

function device(deviceId: string, videoStandard: DeviceVideoStandard): Device {
  return { deviceId, videoStandard } as Device;
}

function render(crtStorage: ICrtStorage, deviceId = 'test-device', devices: Device[] = []) {
  const devicesSignal = signal<Device[]>(devices);
  const result = renderPlayerComponent(FileImageComponent, {
    inputs: { deviceId },
    providers: [
      { provide: CRT_STORAGE, useValue: crtStorage },
      { provide: DeviceStore, useValue: { devices: devicesSignal } },
    ],
  });
  return { ...result, devicesSignal };
}

describe('FileImageComponent', () => {
  it('creates', () => {
    const { component } = render(createMockCrtStorage());

    expect(component).toBeTruthy();
  });

  it('loads saved CRT settings from storage on init', () => {
    const savedSettings: CrtSettings = { ...customPresetSettings, screenCurvature: 20 };
    const crtStorage = createMockCrtStorage({ load: vi.fn(() => savedSettings) });

    const { component } = render(crtStorage);

    expect(component['crtSettings']()).toEqual(savedSettings);
  });

  it('uses the SMALL_IMAGE_WEBGL preset when no saved settings exist', () => {
    const { component } = render(createMockCrtStorage());

    const settings = component['crtSettings']();
    expect(settings.phosphorPattern).toBe('dot-triad');
    expect(settings.bloomIntensity).toBe(0.65);
  });

  it('queries storage under the file-image key', () => {
    const crtStorage = createMockCrtStorage();

    render(crtStorage, 'test-key-device');

    expect(crtStorage.load).toHaveBeenCalledWith('test-key-device', 'file-image');
  });

  it('applies a built-in preset unmodified', () => {
    const { component } = render(createMockCrtStorage());

    component.onCrtPresetSelected(CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL);

    const settings = component['crtSettings']();
    expect(settings.phosphorPattern).toBe('dot-triad');
    expect(settings.bloomIntensity).toBe(0.65);
  });

  it('applies a custom preset unmodified', () => {
    const crtStorage = createMockCrtStorage({
      loadCustomPresets: vi.fn().mockReturnValue(mockCustomPresets),
    });
    const { component } = render(crtStorage);

    component.onCrtPresetSelected('custom-image-preset' as CustomPresetName);

    const settings = component['crtSettings']();
    expect(settings.scanlineIntensity).toBe(0.5);
    expect(settings.brightness).toBe(0.95);
    expect(settings.screenCurvature).toBe(16);
  });

  it('persists a selected custom preset to storage', () => {
    const crtStorage = createMockCrtStorage({
      loadCustomPresets: vi.fn().mockReturnValue(mockCustomPresets),
    });
    const { component } = render(crtStorage, 'test-device');

    component.onCrtPresetSelected('custom-image-preset' as CustomPresetName);

    expect(crtStorage.save).toHaveBeenCalledWith(
      'test-device',
      'file-image',
      expect.objectContaining({ scanlineIntensity: 0.5, screenCurvature: 16 })
    );
  });

  it('leaves settings unchanged and warns when a custom preset is not found', () => {
    const crtStorage = createMockCrtStorage({ loadCustomPresets: vi.fn().mockReturnValue([]) });
    const { component } = render(crtStorage);
    const originalSettings = component['crtSettings']();

    expect(() => component.onCrtPresetSelected('custom-missing' as CustomPresetName)).not.toThrow();

    expect(component['crtSettings']()).toEqual(originalSettings);
  });
});

describe('FileImageComponent video standard', () => {
  it('starts a device with no saved settings in its NTSC standard', () => {
    const { component } = render(
      createMockCrtStorage(),
      'test-device',
      [device('test-device', DeviceVideoStandard.Ntsc)]
    );

    expect(component['crtSettings']().videoStandard).toBe('NTSC');
  });

  it('starts an unknown device in PAL', () => {
    const { component } = render(createMockCrtStorage());

    expect(component['crtSettings']().videoStandard).toBe('PAL');
  });

  it('keeps a saved PAL choice on an NTSC device', () => {
    const crtStorage = createMockCrtStorage({
      load: vi.fn(() => ({ ...customPresetSettings, videoStandard: 'PAL' as const })),
    });
    const { component } = render(crtStorage, 'test-device', [device('test-device', DeviceVideoStandard.Ntsc)]);

    expect(component['crtSettings']().videoStandard).toBe('PAL');
  });

  it('applies the device standard to a built-in preset', () => {
    const { component } = render(createMockCrtStorage(), 'test-device', [
      device('test-device', DeviceVideoStandard.Ntsc),
    ]);

    component.onCrtPresetSelected(CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL);

    expect(component['crtSettings']().videoStandard).toBe('NTSC');
  });

  it('keeps the stored standard of a custom preset', () => {
    const crtStorage = createMockCrtStorage({
      loadCustomPresets: vi.fn().mockReturnValue([
        { ...mockCustomPresets[0], settings: { ...customPresetSettings, videoStandard: 'NTSC' as const } },
      ]),
    });
    const { component } = render(crtStorage, 'test-device', [device('test-device', DeviceVideoStandard.Pal)]);

    component.onCrtPresetSelected('custom-image-preset' as CustomPresetName);

    expect(component['crtSettings']().videoStandard).toBe('NTSC');
  });

  it('adopts the device standard when the device list arrives after the view', () => {
    const { component, devicesSignal, fixture } = render(createMockCrtStorage(), 'test-device');
    expect(component['crtSettings']().videoStandard).toBe('PAL');

    devicesSignal.set([device('test-device', DeviceVideoStandard.Ntsc)]);
    fixture.detectChanges();

    expect(component['crtSettings']().videoStandard).toBe('NTSC');
  });
});
