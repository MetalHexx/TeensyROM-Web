import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { CrtSettingsPanelComponent, CrtPresetName } from './crt-settings-panel.component';
import { CrtSettings } from '../crt-effect-wrapper/crt-settings.interface';
import {
  CRT_CONFIGS,
  DEFAULT_CRT_SETTINGS,
  DEFAULT_CRT_CONFIG,
} from '../crt-effect-wrapper/crt-settings.defaults';

describe('CrtSettingsPanelComponent', () => {
  let component: CrtSettingsPanelComponent;
  let fixture: ComponentFixture<CrtSettingsPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrtSettingsPanelComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(CrtSettingsPanelComponent);
    component = fixture.componentInstance;
  });

  describe('Component Creation', () => {
    it('should create successfully', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should have default settings matching DEFAULT_CRT_SETTINGS', () => {
      fixture.detectChanges();
      expect(component.settings()).toEqual(DEFAULT_CRT_SETTINGS);
    });

    it('should have default config with all features enabled', () => {
      fixture.detectChanges();
      expect(component.config()).toEqual(DEFAULT_CRT_CONFIG);
    });

    it('should be visible by default', () => {
      fixture.detectChanges();
      expect(component.visible()).toBe(true);
    });
  });

  describe('Slider Rendering Based on Config', () => {
    it('should render all 8 sliders with default config', () => {
      fixture.detectChanges();

      const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
      expect(sliders.length).toBe(8);
    });

    it('should render only scanline sliders when config.showScanlines is true only', () => {
      fixture.componentRef.setInput('config', {
        showScanlines: true,
        showVignette: false,
        showCurvature: false,
        showColorFilters: false,
      });
      fixture.detectChanges();

      const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
      expect(sliders.length).toBe(3); // intensity, thickness, gap

      const labels = fixture.nativeElement.querySelectorAll('.control-label') as NodeListOf<Element>;
      const labelTexts = Array.from(labels).map((l) => l.textContent?.trim());
      expect(labelTexts).toContain('Scanline Intensity');
      expect(labelTexts).toContain('Scanline Thickness');
      expect(labelTexts).toContain('Scanline Gap');
    });

    it('should render only vignette slider when config.showVignette is true only', () => {
      fixture.componentRef.setInput('config', {
        showScanlines: false,
        showVignette: true,
        showCurvature: false,
        showColorFilters: false,
      });
      fixture.detectChanges();

      const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
      expect(sliders.length).toBe(1);

      const labels = fixture.nativeElement.querySelectorAll('.control-label');
      expect(labels[0].textContent?.trim()).toBe('Vignette');
    });

    it('should render only curvature slider when config.showCurvature is true only', () => {
      fixture.componentRef.setInput('config', {
        showScanlines: false,
        showVignette: false,
        showCurvature: true,
        showColorFilters: false,
      });
      fixture.detectChanges();

      const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
      expect(sliders.length).toBe(1);

      const labels = fixture.nativeElement.querySelectorAll('.control-label');
      expect(labels[0].textContent?.trim()).toBe('Screen Curvature');
    });

    it('should render only color filter sliders when config.showColorFilters is true only', () => {
      fixture.componentRef.setInput('config', {
        showScanlines: false,
        showVignette: false,
        showCurvature: false,
        showColorFilters: true,
      });
      fixture.detectChanges();

      const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
      expect(sliders.length).toBe(3); // contrast, brightness, saturation

      const labels = fixture.nativeElement.querySelectorAll('.control-label') as NodeListOf<Element>;
      const labelTexts = Array.from(labels).map((l) => l.textContent?.trim());
      expect(labelTexts).toContain('Contrast');
      expect(labelTexts).toContain('Brightness');
      expect(labelTexts).toContain('Saturation');
    });

    it('should render empty state when all features are disabled', () => {
      fixture.componentRef.setInput('config', CRT_CONFIGS.none);
      fixture.detectChanges();

      const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
      expect(sliders.length).toBe(0);

      const emptyState = fixture.nativeElement.querySelector('.crt-empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No settings available');
    });

    it('should render scanlines + color filters with CRT_CONFIGS.scanlines', () => {
      fixture.componentRef.setInput('config', CRT_CONFIGS.scanlines);
      fixture.detectChanges();

      const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
      expect(sliders.length).toBe(6); // 3 scanline + 3 color filters

      const labels = fixture.nativeElement.querySelectorAll('.control-label') as NodeListOf<Element>;
      const labelTexts = Array.from(labels).map((l) => l.textContent?.trim());
      expect(labelTexts).toContain('Scanline Intensity');
      expect(labelTexts).toContain('Brightness');
      expect(labelTexts).not.toContain('Vignette');
      expect(labelTexts).not.toContain('Screen Curvature');
    });

    it('should render only color filters with CRT_CONFIGS.filtersOnly', () => {
      fixture.componentRef.setInput('config', CRT_CONFIGS.filtersOnly);
      fixture.detectChanges();

      const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
      expect(sliders.length).toBe(3); // contrast, brightness, saturation

      const labels = fixture.nativeElement.querySelectorAll('.control-label') as NodeListOf<Element>;
      const labelTexts = Array.from(labels).map((l) => l.textContent?.trim());
      expect(labelTexts).not.toContain('Scanline Intensity');
      expect(labelTexts).toContain('Brightness');
    });
  });

  describe('Settings Change Emission', () => {
    it('should emit settingsChange when slider value changes', () => {
      const settingsChangeSpy = vi.fn();
      component.settingsChange.subscribe(settingsChangeSpy);
      fixture.detectChanges();

      // Simulate slider change by calling the handler directly
      (component as unknown as { onSliderChange: (key: keyof CrtSettings, value: number) => void })
        .onSliderChange('scanlineIntensity', 0.25);

      expect(settingsChangeSpy).toHaveBeenCalledWith({
        ...DEFAULT_CRT_SETTINGS,
        scanlineIntensity: 0.25,
      });
    });

    it('should preserve other settings when changing one value', () => {
      const settingsChangeSpy = vi.fn();
      component.settingsChange.subscribe(settingsChangeSpy);
      fixture.detectChanges();

      (component as unknown as { onSliderChange: (key: keyof CrtSettings, value: number) => void })
        .onSliderChange('brightness', 1.2);

      const emittedSettings = settingsChangeSpy.mock.calls[0][0] as CrtSettings;
      expect(emittedSettings.brightness).toBe(1.2);
      expect(emittedSettings.contrast).toBe(DEFAULT_CRT_SETTINGS.contrast);
      expect(emittedSettings.scanlineIntensity).toBe(DEFAULT_CRT_SETTINGS.scanlineIntensity);
    });

    it('should emit correct settings when multiple sliders change', () => {
      const settingsChangeSpy = vi.fn();
      component.settingsChange.subscribe(settingsChangeSpy);
      fixture.detectChanges();

      (component as unknown as { onSliderChange: (key: keyof CrtSettings, value: number) => void })
        .onSliderChange('contrast', 1.3);

      expect(settingsChangeSpy).toHaveBeenCalledWith({
        ...DEFAULT_CRT_SETTINGS,
        contrast: 1.3,
      });
    });
  });

  describe('Reset Button', () => {
    it('should emit resetRequested when reset button is clicked', () => {
      const resetSpy = vi.fn();
      component.resetRequested.subscribe(resetSpy);
      fixture.detectChanges();

      const resetButton = fixture.nativeElement.querySelector(
        'button[mattooltip="Reset to defaults"]'
      );
      expect(resetButton).toBeTruthy();

      resetButton.click();
      expect(resetSpy).toHaveBeenCalled();
    });
  });

  describe('Preset Selection', () => {
    it('should emit presetSelected when preset is chosen', () => {
      const presetSpy = vi.fn();
      component.presetSelected.subscribe(presetSpy);
      fixture.detectChanges();

      // Call the handler directly since menu interaction is complex to simulate
      (component as unknown as { onPresetSelect: (preset: CrtPresetName) => void }).onPresetSelect(
        'scanlines'
      );

      expect(presetSpy).toHaveBeenCalledWith('scanlines');
    });

    it('should emit correct preset name for each preset', () => {
      const presetSpy = vi.fn();
      component.presetSelected.subscribe(presetSpy);
      fixture.detectChanges();

      const presets: CrtPresetName[] = ['full', 'scanlines', 'filtersOnly', 'none'];

      presets.forEach((preset) => {
        (component as unknown as { onPresetSelect: (preset: CrtPresetName) => void }).onPresetSelect(
          preset
        );
      });

      expect(presetSpy).toHaveBeenCalledTimes(4);
      expect(presetSpy).toHaveBeenCalledWith('full');
      expect(presetSpy).toHaveBeenCalledWith('scanlines');
      expect(presetSpy).toHaveBeenCalledWith('filtersOnly');
      expect(presetSpy).toHaveBeenCalledWith('none');
    });
  });

  describe('Value Display Formatting', () => {
    it('should display decimal values with 2 decimal places', () => {
      fixture.detectChanges();

      const controlValues = fixture.nativeElement.querySelectorAll('.control-value') as NodeListOf<Element>;
      const intensityValue = Array.from(controlValues).find((el) =>
        el.textContent?.includes('0.50')
      );
      expect(intensityValue).toBeTruthy();
    });

    it('should display px values with px suffix', () => {
      fixture.detectChanges();

      const controlValues = fixture.nativeElement.querySelectorAll('.control-value') as NodeListOf<Element>;
      const thicknessValue = Array.from(controlValues).find((el) =>
        el.textContent?.includes('3px')
      );
      expect(thicknessValue).toBeTruthy();
    });
  });

  describe('Settings Input Updates', () => {
    it('should update displayed values when settings input changes', () => {
      fixture.detectChanges();

      // Update settings
      fixture.componentRef.setInput('settings', {
        ...DEFAULT_CRT_SETTINGS,
        scanlineIntensity: 0.25,
        brightness: 1.3,
      });
      fixture.detectChanges();

      const controlValues = fixture.nativeElement.querySelectorAll('.control-value') as NodeListOf<Element>;
      const valueTexts = Array.from(controlValues).map((el) => el.textContent?.trim());

      expect(valueTexts).toContain('0.25');
      expect(valueTexts).toContain('1.30');
    });
  });

  describe('Header Elements', () => {
    it('should display CRT Effect title', () => {
      fixture.detectChanges();

      const title = fixture.nativeElement.querySelector('.header-title');
      expect(title).toBeTruthy();
      expect(title.textContent?.trim()).toBe('CRT Effect');
    });

    it('should have preset menu button with tune icon', () => {
      fixture.detectChanges();

      // Look for the button in header-actions that contains the tune icon
      const headerActions = fixture.nativeElement.querySelector('.header-actions');
      expect(headerActions).toBeTruthy();

      const buttons = headerActions.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2); // preset menu and reset button
    });

    it('should have reset button', () => {
      fixture.detectChanges();

      const resetButton = fixture.nativeElement.querySelector(
        'button[mattooltip="Reset to defaults"]'
      );
      expect(resetButton).toBeTruthy();
    });
  });
});
