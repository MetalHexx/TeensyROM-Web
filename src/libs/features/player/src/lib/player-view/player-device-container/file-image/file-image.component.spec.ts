import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FileImageComponent } from './file-image.component';
import {
  CRT_STORAGE,
  ICrtStorage,
  CustomCrtPreset,
  CustomPresetName,
} from '@teensyrom-nx/domain';
import { CRT_PRESET_KEYS } from '@teensyrom-nx/ui/components';
import { vi } from 'vitest';

/** Mock custom presets for testing */
const mockCustomPresets: CustomCrtPreset[] = [
  {
    name: 'custom-image-preset' as CustomPresetName,
    settings: {
      scanlineIntensity: 0.5,
      scanlineSize: 1.5,
      vignetteStrength: 1.1,
      screenCurvature: 16, // Will be forced to 16 anyway
      contrast: 1.1,
      brightness: 0.95,
      saturation: 1.1,
      hue: 0,
      phosphorPattern: 'none',
      phosphorIntensity: 0,
      bloomEnabled: false,
      bloomIntensity: 0.3,
      bloomRadius: 3,
      barrelDistortion: 0,
      chromaticAberration: 0,
    },
    createdAt: '2025-12-07T13:00:00.000Z',
  },
];

/** Mock CRT storage for testing - stores nothing, returns null */
const mockCrtStorage: ICrtStorage = {
  save: vi.fn(),
  load: vi.fn(() => null),
  hasSavedSettings: vi.fn(() => false),
  clear: vi.fn(),
  loadCustomPresets: vi.fn().mockReturnValue([]),
  saveCustomPreset: vi.fn(),
  deleteCustomPreset: vi.fn(),
  renameCustomPreset: vi.fn(),
  hasCustomPreset: vi.fn().mockReturnValue(false),
};

describe('FileImageComponent', () => {
  let component: FileImageComponent;
  let fixture: ComponentFixture<FileImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileImageComponent],
      providers: [
        provideNoopAnimations(),
        { provide: CRT_STORAGE, useValue: mockCrtStorage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FileImageComponent);
    component = fixture.componentInstance;
    // Set required input before change detection
    fixture.componentRef.setInput('deviceId', 'test-device');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should use saved settings when available', () => {
      const savedSettings = {
        scanlineIntensity: 0.75,
        scanlineSize: 1.5,
        vignetteStrength: 1.2,
        screenCurvature: 20,
        contrast: 1.1,
        brightness: 0.9,
        saturation: 1.0,
        hue: 0,
        phosphorPattern: 'none' as const,
        phosphorIntensity: 0,
        bloomEnabled: false,
        bloomIntensity: 0.3,
        bloomRadius: 3,
        barrelDistortion: 0,
        chromaticAberration: 0,
      };
      
      vi.mocked(mockCrtStorage.load).mockReturnValueOnce(savedSettings);

      // Create new component to trigger initialization
      const newFixture = TestBed.createComponent(FileImageComponent);
      newFixture.componentRef.setInput('deviceId', 'saved-device');
      newFixture.detectChanges();
      const newComponent = newFixture.componentInstance;

      const settings = newComponent['crtSettings']();
      expect(settings).toEqual(savedSettings);
    });

    it('should use SMALL_IMAGE_WEBGL preset when no saved settings', () => {
      vi.mocked(mockCrtStorage.load).mockReturnValue(null);

      // Create new component to trigger initialization
      const newFixture = TestBed.createComponent(FileImageComponent);
      newFixture.componentRef.setInput('deviceId', 'new-device');
      newFixture.detectChanges();
      const newComponent = newFixture.componentInstance;

      const settings = newComponent['crtSettings']();
      // Should match SMALL_IMAGE_WEBGL preset
      expect(settings.phosphorPattern).toBe('aperture-grille');
      expect(settings.bloomIntensity).toBe(0);
    });

    it('should use storage key "file-image"', () => {
      vi.mocked(mockCrtStorage.load).mockClear();

      // Create new component to trigger initialization
      const newFixture = TestBed.createComponent(FileImageComponent);
      newFixture.componentRef.setInput('deviceId', 'test-key-device');
      newFixture.detectChanges();

      expect(mockCrtStorage.load).toHaveBeenCalledWith('test-key-device', 'file-image');
    });
  });

  describe('CRT preset selection', () => {
    it('should apply built-in preset without modification', () => {
      component.onCrtPresetSelected(CRT_PRESET_KEYS.SMALL_IMAGE_WEBGL);
      
      const settings = component['crtSettings']();
      expect(settings.phosphorPattern).toBe('aperture-grille');
      expect(settings.bloomIntensity).toBe(0);
      // Settings applied as-is from preset
    });

    it('should apply custom preset without modification', () => {
      vi.mocked(mockCrtStorage.loadCustomPresets).mockReturnValue(mockCustomPresets);

      component.onCrtPresetSelected('custom-image-preset' as CustomPresetName);
      
      const settings = component['crtSettings']();
      expect(settings.scanlineIntensity).toBe(0.5);
      expect(settings.brightness).toBe(0.95);
      expect(settings.screenCurvature).toBe(16); // From custom preset, not forced
    });

    it('should call loadCustomPresets when custom preset selected', () => {
      vi.mocked(mockCrtStorage.loadCustomPresets).mockReturnValue(mockCustomPresets);

      vi.mocked(mockCrtStorage.loadCustomPresets).mockClear();

      component.onCrtPresetSelected('custom-image-preset' as CustomPresetName);
      
      expect(mockCrtStorage.loadCustomPresets).toHaveBeenCalled();
    });

    it('should persist custom preset settings to storage', () => {
      vi.mocked(mockCrtStorage.loadCustomPresets).mockReturnValue(mockCustomPresets);
      const saveSpy = vi.mocked(mockCrtStorage.save);

      saveSpy.mockClear();

      component.onCrtPresetSelected('custom-image-preset' as CustomPresetName);
      
      expect(saveSpy).toHaveBeenCalledWith(
        'test-device',
        'file-image',
        expect.objectContaining({
          scanlineIntensity: 0.5,
          screenCurvature: 16, // From preset, not modified
        })
      );
    });

    it('should log warning when custom preset not found', () => {
      vi.mocked(mockCrtStorage.loadCustomPresets).mockReturnValue([]);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { /* intentionally empty */ });

      const originalSettings = component['crtSettings']();

      component.onCrtPresetSelected('custom-nonexistent' as CustomPresetName);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[FileImageComponent] Custom preset not found: custom-nonexistent'
      );

      expect(component['crtSettings']()).toEqual(originalSettings);

      consoleWarnSpy.mockRestore();
    });

    it('should not change settings when custom preset not found', () => {
      vi.mocked(mockCrtStorage.loadCustomPresets).mockReturnValue([]);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { /* intentionally empty */ });

      const customSettings = {
        scanlineIntensity: 0.99,
        scanlineSize: 10,
        vignetteStrength: 2.5,
        screenCurvature: 16,
        contrast: 2.0,
        brightness: 2.5,
        saturation: 2.0,
        hue: 0,
        phosphorPattern: 'none' as const,
        phosphorIntensity: 0,
        bloomEnabled: false,
        bloomIntensity: 0.3,
        bloomRadius: 3,
        barrelDistortion: 0,
        chromaticAberration: 0,
      };
      component.onCrtSettingsChange(customSettings);

      component.onCrtPresetSelected('custom-missing' as CustomPresetName);
      
      expect(component['crtSettings']()).toEqual(customSettings);

      consoleWarnSpy.mockRestore();
    });

    it('should handle empty custom presets array gracefully', () => {
      vi.mocked(mockCrtStorage.loadCustomPresets).mockReturnValue([]);

      const originalSettings = component['crtSettings']();

      expect(() => {
        component.onCrtPresetSelected('custom-test' as CustomPresetName);
      }).not.toThrow();

      expect(component['crtSettings']()).toEqual(originalSettings);
    });
  });
});
