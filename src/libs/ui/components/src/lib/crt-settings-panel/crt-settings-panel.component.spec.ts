import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { CrtSettingsPanelComponent, CrtPresetName } from './crt-settings-panel.component';
import { CrtSettings } from '../crt-effect-wrapper/crt-settings.interface';
import {
  CRT_CONFIGS,
  DEFAULT_CRT_SETTINGS,
  DEFAULT_CRT_CONFIG,
  CRT_PRESET_KEYS,
} from '../crt-effect-wrapper/crt-settings.defaults';
import { CRT_STORAGE, CustomCrtPreset, CustomPresetName } from '@teensyrom-nx/domain';

/** Helper to find icon button by mat-icon content */
function findIconButton(container: HTMLElement, iconName: string): HTMLElement | undefined {
  const iconButtons = container.querySelectorAll('lib-icon-button');
  return Array.from(iconButtons).find(
    (btn) => btn.querySelector('mat-icon')?.textContent?.trim() === iconName
  ) as HTMLElement | undefined;
}

/** Mock CRT Storage Service */
const mockCrtStorage = {
  loadCustomPresets: vi.fn().mockReturnValue([]),
  saveCustomPreset: vi.fn(),
  updateCustomPreset: vi.fn(),
  deleteCustomPreset: vi.fn(),
  renameCustomPreset: vi.fn(),
  hasCustomPreset: vi.fn().mockReturnValue(false),
  save: vi.fn(),
  load: vi.fn().mockReturnValue(null),
  hasSavedSettings: vi.fn().mockReturnValue(false),
  clear: vi.fn(),
};

/** Mock validation function for preset names */
const mockValidatePresetName = vi.fn((name: string) => {
  if (!name || name.trim() === '') {
    return { error: 'Name cannot be empty' };
  }
  if (name.length < 3) {
    return { error: 'Name must be at least 3 characters' };
  }
  if (name.length > 50) {
    return { error: 'Name cannot exceed 50 characters' };
  }
  return { error: null };
});

/** Test fixtures for custom presets */
const mockCustomPresets: CustomCrtPreset[] = [
  {
    name: 'custom-arcade-setup' as CustomPresetName,
    settings: { ...DEFAULT_CRT_SETTINGS, scanlineIntensity: 0.7 },
    createdAt: '2025-12-07T10:00:00.000Z',
  },
  {
    name: 'custom-my-preset' as CustomPresetName,
    settings: { ...DEFAULT_CRT_SETTINGS, contrast: 1.2 },
    createdAt: '2025-12-07T11:00:00.000Z',
  },
  {
    name: 'custom-zebra-test' as CustomPresetName,
    settings: { ...DEFAULT_CRT_SETTINGS, brightness: 1.1 },
    createdAt: '2025-12-07T09:00:00.000Z',
  },
];

describe('CrtSettingsPanelComponent', () => {
  let component: CrtSettingsPanelComponent;
  let fixture: ComponentFixture<CrtSettingsPanelComponent>;

  /** Helper to create component with required inputs */
  function createComponentFixture(): ComponentFixture<CrtSettingsPanelComponent> {
    const f = TestBed.createComponent(CrtSettingsPanelComponent);
    f.componentRef.setInput('validatePresetNameFn', mockValidatePresetName);
    return f;
  }

  beforeEach(async () => {
    // Reset mock between tests
    vi.clearAllMocks();
    mockCrtStorage.loadCustomPresets.mockReturnValue([]);
    
    await TestBed.configureTestingModule({
      imports: [CrtSettingsPanelComponent, NoopAnimationsModule],
      providers: [
        { provide: CRT_STORAGE, useValue: mockCrtStorage },
      ],
    }).compileComponents();

    fixture = createComponentFixture();
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
  });

  describe('Slider Rendering Based on Config', () => {
    it('should render all 12 sliders with default config', () => {
      fixture.detectChanges();

      const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
      expect(sliders.length).toBe(12); // 2 scanline + 1 vignette + 1 curvature + 4 color + 1 phosphor + 2 barrel + 1 bloom
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
      expect(sliders.length).toBe(2); // intensity, size

      const labels = fixture.nativeElement.querySelectorAll('.control-label') as NodeListOf<Element>;
      const labelTexts = Array.from(labels).map((l) => l.textContent?.trim());
      expect(labelTexts).toContain('Scanline Intensity');
      expect(labelTexts).toContain('Scanline Size');
    });

    it('should render only vignette slider when config.showVignette is true only', () => {
      fixture.componentRef.setInput('config', {
        showScanlines: false,
        showVignette: true,
        showCurvature: false,
        showColorFilters: false,
        showPhosphor: false,
        showBloom: false,
        showDistortion: false,
        showChromaticAberration: false,
      });
      fixture.detectChanges();

      const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
      expect(sliders.length).toBe(1);

      const labels = fixture.nativeElement.querySelectorAll('.control-label') as NodeListOf<Element>;
      const labelTexts = Array.from(labels).map((l) => l.textContent?.trim());
      expect(labelTexts).toContain('Vignette');
    });

    it('should render only curvature slider when config.showCurvature is true only', () => {
      fixture.componentRef.setInput('config', {
        showScanlines: false,
        showVignette: false,
        showCurvature: true,
        showColorFilters: false,
        showPhosphor: false,
        showBloom: false,
        showDistortion: false,
        showChromaticAberration: false,
      });
      fixture.detectChanges();

      const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
      expect(sliders.length).toBe(1);

      const labels = fixture.nativeElement.querySelectorAll('.control-label') as NodeListOf<Element>;
      const labelTexts = Array.from(labels).map((l) => l.textContent?.trim());
      expect(labelTexts).toContain('Screen Curvature');
    });

    it('should render only distortion slider when config.showDistortion is true only', () => {
      fixture.componentRef.setInput('config', {
        showScanlines: false,
        showVignette: false,
        showCurvature: false,
        showDistortion: true,
        showColorFilters: false,
        showPhosphor: false,
        showBloom: false,
        showChromaticAberration: false,
      });
      fixture.detectChanges();

      const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
      expect(sliders.length).toBe(1);

      const labels = fixture.nativeElement.querySelectorAll('.control-label') as NodeListOf<Element>;
      const labelTexts = Array.from(labels).map((l) => l.textContent?.trim());
      expect(labelTexts).toContain('Barrel Distortion');
    });

    it('should not render distortion slider when config.showDistortion is false', () => {
      fixture.componentRef.setInput('config', {
        showScanlines: false,
        showVignette: false,
        showCurvature: false,
        showDistortion: false,
        showColorFilters: false,
        showPhosphor: false,
        showBloom: false,
        showChromaticAberration: false,
      });
      fixture.detectChanges();

      const labels = fixture.nativeElement.querySelectorAll('.control-label') as NodeListOf<Element>;
      const labelTexts = Array.from(labels).map((l) => l.textContent?.trim());
      expect(labelTexts).not.toContain('Barrel Distortion');
    });

    it('should render only color filter sliders when config.showColorFilters is true only', () => {
      fixture.componentRef.setInput('config', {
        showScanlines: false,
        showVignette: false,
        showCurvature: false,
        showColorFilters: true,
        showPhosphor: false,
        showBloom: false,
        showDistortion: false,
        showChromaticAberration: false,
      });
      fixture.detectChanges();

      const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
      expect(sliders.length).toBe(4); // contrast, brightness, saturation, hue

      const labels = fixture.nativeElement.querySelectorAll('.control-label') as NodeListOf<Element>;
      const labelTexts = Array.from(labels).map((l) => l.textContent?.trim());
      expect(labelTexts).toContain('Contrast');
      expect(labelTexts).toContain('Brightness');
      expect(labelTexts).toContain('Saturation');
      expect(labelTexts).toContain('Hue');
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

    it('should render scanlines + vignette + color filters with CRT_CONFIGS.small', () => {
      fixture.componentRef.setInput('config', CRT_CONFIGS.small);
      fixture.detectChanges();

      const sliders = fixture.nativeElement.querySelectorAll('mat-slider');
      expect(sliders.length).toBe(11); // 2 scanline + 1 vignette + 4 color + 1 phosphor + 1 bloom + 1 distortion + 1 chromatic (no curvature)

      const labels = fixture.nativeElement.querySelectorAll('.control-label') as NodeListOf<Element>;
      const labelTexts = Array.from(labels).map((l) => l.textContent?.trim());
      expect(labelTexts).toContain('Scanline Intensity');
      expect(labelTexts).toContain('Vignette');
      expect(labelTexts).toContain('Brightness');
      expect(labelTexts).not.toContain('Screen Curvature');
    });

  });

  describe('Settings Change Emission', () => {
    /** Helper to call protected onSliderChange method */
    function callOnSliderChange(key: keyof CrtSettings, value: number): void {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onSliderChange(key, value);
    }

    it('should emit settingsChange when slider value changes', () => {
      const settingsChangeSpy = vi.fn();
      component.settingsChange.subscribe(settingsChangeSpy);
      fixture.detectChanges();

      // Simulate slider change by calling the handler directly
      callOnSliderChange('scanlineIntensity', 0.25);

      expect(settingsChangeSpy).toHaveBeenCalledWith({
        ...DEFAULT_CRT_SETTINGS,
        scanlineIntensity: 0.25,
      });
    });

    it('should preserve other settings when changing one value', () => {
      const settingsChangeSpy = vi.fn();
      component.settingsChange.subscribe(settingsChangeSpy);
      fixture.detectChanges();

      callOnSliderChange('brightness', 1.2);

      const emittedSettings = settingsChangeSpy.mock.calls[0][0] as CrtSettings;
      expect(emittedSettings.brightness).toBe(1.2);
      expect(emittedSettings.contrast).toBe(DEFAULT_CRT_SETTINGS.contrast);
      expect(emittedSettings.scanlineIntensity).toBe(DEFAULT_CRT_SETTINGS.scanlineIntensity);
    });

    it('should emit correct settings when multiple sliders change', () => {
      const settingsChangeSpy = vi.fn();
      component.settingsChange.subscribe(settingsChangeSpy);
      fixture.detectChanges();

      callOnSliderChange('contrast', 1.3);

      expect(settingsChangeSpy).toHaveBeenCalledWith({
        ...DEFAULT_CRT_SETTINGS,
        contrast: 1.3,
      });
    });

    it('should emit settingsChange when distortion slider value changes', () => {
      const settingsChangeSpy = vi.fn();
      component.settingsChange.subscribe(settingsChangeSpy);
      fixture.detectChanges();

      callOnSliderChange('barrelDistortion', 0.3);

      expect(settingsChangeSpy).toHaveBeenCalledWith({
        ...DEFAULT_CRT_SETTINGS,
        barrelDistortion: 0.3,
      });
    });

    it('should preserve other settings when changing distortion value', () => {
      const settingsChangeSpy = vi.fn();
      component.settingsChange.subscribe(settingsChangeSpy);
      fixture.detectChanges();

      callOnSliderChange('barrelDistortion', 0.2);

      const emittedSettings = settingsChangeSpy.mock.calls[0][0] as CrtSettings;
      expect(emittedSettings.barrelDistortion).toBe(0.2);
      expect(emittedSettings.screenCurvature).toBe(DEFAULT_CRT_SETTINGS.screenCurvature);
      expect(emittedSettings.vignetteStrength).toBe(DEFAULT_CRT_SETTINGS.vignetteStrength);
    });
  });



  describe('Preset Selection', () => {
    /** Helper to call protected onPresetSelect method */
    function callOnPresetSelect(preset: CrtPresetName): void {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onPresetSelect(preset);
    }

    it('should emit presetSelected when preset is chosen', () => {
      const presetSpy = vi.fn();
      component.presetSelected.subscribe(presetSpy);
      fixture.detectChanges();

      // Call the handler directly since menu interaction is complex to simulate
      callOnPresetSelect('default-small-webgl');

      expect(presetSpy).toHaveBeenCalledWith('default-small-webgl');
    });

    it('should emit correct preset name for each preset', () => {
      const presetSpy = vi.fn();
      component.presetSelected.subscribe(presetSpy);
      fixture.detectChanges();

      const presets: CrtPresetName[] = ['default-small-webgl', 'default-large-webgl'];

      presets.forEach((preset) => {
        callOnPresetSelect(preset);
      });

      expect(presetSpy).toHaveBeenCalledTimes(2);
      expect(presetSpy).toHaveBeenCalledWith('default-small-webgl');
      expect(presetSpy).toHaveBeenCalledWith('default-large-webgl');
    });
  });

  describe('Value Display Formatting', () => {
    it('should display percentage values with % suffix', () => {
      fixture.detectChanges();

      const controlValues = fixture.nativeElement.querySelectorAll('.control-value') as NodeListOf<Element>;
      const intensityValue = Array.from(controlValues).find((el) =>
        el.textContent?.includes('50%')
      );
      expect(intensityValue).toBeTruthy();
    });

    it('should display px values with px suffix', () => {
      fixture.detectChanges();

      const controlValues = fixture.nativeElement.querySelectorAll('.control-value') as NodeListOf<Element>;
      const sizeValue = Array.from(controlValues).find((el) =>
        el.textContent?.includes('2.5px')
      );
      expect(sizeValue).toBeTruthy();
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

      expect(valueTexts).toContain('25%');
      expect(valueTexts).toContain('130%');
    });
  });

  describe('Header Elements', () => {
    it('should display CRT Effect title', () => {
      fixture.detectChanges();

      const title = fixture.nativeElement.querySelector('.header-title');
      expect(title).toBeTruthy();
      expect(title.textContent?.trim()).toBe('CRT Effect');
    });

    it('should have preset menu button with bookmark icon', () => {
      fixture.detectChanges();

      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      expect(bookmarkButton).toBeTruthy();
    });
  });

  describe('Preset Dropdown', () => {
    it('should render dropdown trigger button in header', () => {
      fixture.detectChanges();

      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      expect(bookmarkButton).toBeTruthy();
    });

    it('should open dropdown when trigger is clicked', async () => {
      fixture.detectChanges();

      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      const innerButton = bookmarkButton?.querySelector('button');
      innerButton?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      // Check that the dropdown opened by looking for menu items in the overlay
      const overlay = document.querySelector('.cdk-overlay-container');
      const menuItems = overlay?.querySelectorAll('lib-dropdown-menu-item');
      expect(menuItems?.length).toBe(4); // 3 built-in presets + 1 save custom
    });

    it('should display all two built-in preset options', async () => {
      fixture.detectChanges();

      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      const innerButton = bookmarkButton?.querySelector('button');
      innerButton?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const overlay = document.querySelector('.cdk-overlay-container');
      const menuItems = overlay?.querySelectorAll('lib-dropdown-menu-item');
      const itemTexts = Array.from(menuItems || []).map((item) =>
        item.textContent?.trim()
      );

      expect(itemTexts).toContain('Small Video (WebGL)');
      expect(itemTexts).toContain('Large Video (WebGL)');
      expect(itemTexts).toContain('Small Image (WebGL)');
    });

    it('should emit presetSelected when dropdown item is clicked', async () => {
      const presetSpy = vi.fn();
      component.presetSelected.subscribe(presetSpy);
      fixture.detectChanges();

      // Open the dropdown
      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      const innerButton = bookmarkButton?.querySelector('button');
      innerButton?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      // Click the 'default-small-video-webgl' preset item via the button element
      const overlay = document.querySelector('.cdk-overlay-container');
      const smallWebglButton = overlay?.querySelector('[data-testid="preset-default-small-video-webgl"]') as HTMLElement;
      smallWebglButton?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(presetSpy).toHaveBeenCalledWith('default-small-video-webgl');
    });

    it('should have dropdown that auto-closes after item click via DropdownMenuItemComponent', async () => {
      fixture.detectChanges();

      // Open the dropdown
      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      const innerButton = bookmarkButton?.querySelector('button');
      innerButton?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      // Verify dropdown is open
      const overlay = document.querySelector('.cdk-overlay-container');
      const menuWrapper = overlay?.querySelector('.dropdown-menu-wrapper');
      expect(menuWrapper).toBeTruthy();

      // Click a preset item - the DropdownMenuItemComponent has autoClose=true by default
      // which calls parentDropdown.close() after emitting itemClick
      const largeWebglButton = overlay?.querySelector('[data-testid="preset-default-large-video-webgl"]') as HTMLElement;
      largeWebglButton?.click();
      fixture.detectChanges();
      
      // Give time for async close operation  
      await new Promise(resolve => setTimeout(resolve, 200));
      fixture.detectChanges();

      // The dropdown should be closed (no menu wrapper visible)
      const menuWrapperAfter = document.querySelector('.cdk-overlay-container .dropdown-menu-wrapper');
      expect(menuWrapperAfter).toBeFalsy();
    });
  });

  describe('Card class forwarding', () => {
    it('should forward cardClass input to the compact card layout', () => {
      fixture.componentRef.setInput('cardClass', 'my-custom-panel-class');
      fixture.detectChanges();

      // Check the computed property value directly
      expect(component['computedCardClass']()).toContain('my-custom-panel-class');
    });

    it('should include base classes when cardClass is provided', () => {
      fixture.componentRef.setInput('cardClass', 'extra-class');
      fixture.detectChanges();

      const cardClass = component['computedCardClass']();
      expect(cardClass).toContain('glassy-card');
      expect(cardClass).toContain('crt-controls-card');
      expect(cardClass).toContain('extra-class');
    });

    it('should only have base classes when no cardClass is provided', () => {
      fixture.detectChanges();

      const cardClass = component['computedCardClass']();
      expect(cardClass).toBe('glassy-card crt-controls-card');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Custom Preset State Management Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Custom Preset State Management', () => {
    it('should inject CRT storage service via CRT_STORAGE token', () => {
      fixture.detectChanges();
      expect(mockCrtStorage.loadCustomPresets).toHaveBeenCalled();
    });

    it('should load custom presets on component initialization', () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(mockCrtStorage.loadCustomPresets).toHaveBeenCalled();
      expect(component['customPresets']()).toEqual(mockCustomPresets);
    });

    it('should set empty array if loading custom presets fails', () => {
      mockCrtStorage.loadCustomPresets.mockImplementation(() => {
        throw new Error('Storage error');
      });

      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['customPresets']()).toEqual([]);
    });

    it('should have dialog visibility signals default to false', () => {
      fixture.detectChanges();
      
      expect(component['showNameDialog']()).toBe(false);
      expect(component['showConfirmDialog']()).toBe(false);
    });

    it('should have empty dialogPresetName signal initially', () => {
      fixture.detectChanges();
      expect(component['dialogPresetName']()).toBe('');
    });

    it('should have isRenaming signal default to false', () => {
      fixture.detectChanges();
      expect(component['isRenaming']()).toBe(false);
    });
  });

  describe('All Presets Computed', () => {
    it('should combine built-in and custom presets correctly', () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();

      const allPresets = component['allPresets']();
      
      expect(allPresets.builtIn.length).toBe(3); // 3 built-in presets
    });

    it('should filter out excluded presets from allPresets', () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      
      // Create new fixture with excludePresets input
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.componentRef.setInput('excludePresets', ['default-large-video-webgl' as CrtPresetName, 'default-small-image-webgl' as CrtPresetName]);
      fixture.detectChanges();

      const allPresets = component['allPresets']();
      expect(allPresets.builtIn.length).toBe(1); // Only small-video preset remains
      expect(allPresets.builtIn[0]).toBe('default-small-video-webgl');
      expect(allPresets.custom.length).toBe(3);
      expect(allPresets.custom).toEqual(mockCustomPresets.sort((a, b) => 
        a.name.localeCompare(b.name)
      ));
    });

    it('should sort custom presets alphabetically', () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();

      const allPresets = component['allPresets']();
      const customNames = allPresets.custom.map(p => p.name);
      
      // Should be sorted: arcade, my-preset, zebra
      expect(customNames[0]).toBe('custom-arcade-setup');
      expect(customNames[1]).toBe('custom-my-preset');
      expect(customNames[2]).toBe('custom-zebra-test');
    });

    it('should handle empty custom presets array', () => {
      fixture.detectChanges();

      const allPresets = component['allPresets']();
      
      expect(allPresets.builtIn.length).toBe(3);
      expect(allPresets.custom.length).toBe(0);
    });
  });

  describe('Current Preset Detection', () => {
    it('should detect matching built-in preset', () => {
      fixture.componentRef.setInput('settings', DEFAULT_CRT_SETTINGS);
      fixture.detectChanges();

      const currentName = component['currentPresetName']();
      // DEFAULT_CRT_SETTINGS should match one of the built-in presets
      expect(currentName).toBeTruthy();
    });

    it('should detect matching custom preset', () => {
      const customPreset = mockCustomPresets[0];
      mockCrtStorage.loadCustomPresets.mockReturnValue([customPreset]);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.componentRef.setInput('settings', customPreset.settings);
      fixture.detectChanges();

      const currentName = component['currentPresetName']();
      expect(currentName).toBe(customPreset.name);
    });

    it('should return null if settings don\'t match any preset', () => {
      const uniqueSettings: CrtSettings = {
        ...DEFAULT_CRT_SETTINGS,
        scanlineIntensity: 0.123, // Unlikely to match any preset
        brightness: 0.987,
      };
      
      fixture.componentRef.setInput('settings', uniqueSettings);
      fixture.detectChanges();

      const currentName = component['currentPresetName']();
      expect(currentName).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Dropdown UI Rendering Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Dropdown UI Sections', () => {
    it('should render built-in presets without section label', async () => {
      fixture.detectChanges();

      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const overlay = document.querySelector('.cdk-overlay-container');
      // Built-in section label should not exist (only "Custom Presets" label should be present)
      const sectionLabels = overlay?.querySelectorAll('.dropdown-section-label');
      expect(sectionLabels?.length).toBe(1); // Only custom presets section
      expect(sectionLabels?.[0]?.textContent?.trim()).toBe('Custom Presets');
    });

    it('should display all built-in presets in built-in section', async () => {
      fixture.detectChanges();

      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const overlay = document.querySelector('.cdk-overlay-container');
      const menuItems = overlay?.querySelectorAll('lib-dropdown-menu-item');
      
      // 2 built-in + 1 save action (no custom presets in this test)
      expect(menuItems?.length).toBeGreaterThanOrEqual(2);
    });

    it('should render section divider between built-in and custom', async () => {
      fixture.detectChanges();

      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const overlay = document.querySelector('.cdk-overlay-container');
      const dividers = overlay?.querySelectorAll('.dropdown-divider');
      expect(dividers?.length).toBeGreaterThanOrEqual(2); // At least 2 dividers
    });

    it('should render custom presets section label', async () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();

      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const overlay = document.querySelector('.cdk-overlay-container');
      const labels = overlay?.querySelectorAll('.dropdown-section-label');
      const labelTexts = Array.from(labels || []).map(l => l.textContent?.trim());
      
      expect(labelTexts).toContain('Custom Presets');
    });

    it('should display custom presets when they exist', async () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges(); // Extra cycle for overlay rendering

      const overlay = document.querySelector('.cdk-overlay-container');
      const customItems = overlay?.querySelectorAll('lib-dropdown-menu-item button[data-testid^="preset-custom-"]');
      
      expect(customItems?.length).toBe(3);
    });

    it('should sort custom presets alphabetically in UI', async () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges(); // Extra cycle for overlay rendering

      const overlay = document.querySelector('.cdk-overlay-container');
      const customItems = overlay?.querySelectorAll('lib-dropdown-menu-item button[data-testid^="preset-custom-"]');
      const customNames = Array.from(customItems || []).map(item => {
        // Extract text from the .item-label span only (excludes action buttons)
        const labelSpan = item.querySelector('.item-label');
        return labelSpan?.textContent?.trim() || '';
      });
      
      // Should be alphabetically sorted (without 'custom-' prefix)
      expect(customNames[0]).toBe('arcade-setup');
      expect(customNames[1]).toBe('my-preset');
      expect(customNames[2]).toBe('zebra-test');
    });

    it('should display empty state when no custom presets exist', async () => {
      fixture.detectChanges();

      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const overlay = document.querySelector('.cdk-overlay-container');
      const emptyState = overlay?.querySelector('.dropdown-empty-state');
      
      expect(emptyState?.textContent?.trim()).toBe('No custom presets');
    });

    it('should display rename and delete buttons for each custom preset', async () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges(); // Extra cycle for overlay rendering

      const overlay = document.querySelector('.cdk-overlay-container');
      const customItems = overlay?.querySelectorAll('lib-dropdown-menu-item button[data-testid^="preset-custom-"]');
      expect(customItems?.length).toBe(3);
      
      // Each action container should have 3 buttons (save, rename, delete)
      const presetActions = overlay?.querySelectorAll('lib-dropdown-menu-item button[data-testid^="preset-custom-"] .item-actions');
      presetActions?.forEach(actions => {
        const buttons = actions.querySelectorAll('lib-icon-button');
        expect(buttons.length).toBe(3);
      });
    });

    it('should always display save action at bottom', async () => {
      fixture.detectChanges();

      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const overlay = document.querySelector('.cdk-overlay-container');
      const menuItems = overlay?.querySelectorAll('lib-dropdown-menu-item');
      const lastItem = menuItems?.[menuItems.length - 1];
      
      expect(lastItem?.textContent).toContain('Save Current as Preset');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Preset Interaction Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Preset Interaction', () => {
    it('should call onPresetSelect with custom preset name when custom preset clicked', async () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      const presetSpy = vi.fn();
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      component.presetSelected.subscribe(presetSpy);
      fixture.detectChanges();
      await fixture.whenStable();

      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges(); // Extra cycle for overlay rendering

      // Find and click custom preset
      const overlay = document.querySelector('.cdk-overlay-container');
      const customPresetButton = overlay?.querySelector('lib-dropdown-menu-item button[data-testid="preset-custom-arcade-setup"]') as HTMLElement;
      customPresetButton?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(presetSpy).toHaveBeenCalledWith('custom-arcade-setup');
    });

    it('should open name dialog when rename button clicked', () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue([mockCustomPresets[0]]);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();

      // Call the method directly (UI interaction complex with action buttons)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onRenamePreset('custom-arcade-setup' as CustomPresetName);

      // Should open name dialog in rename mode
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showNameDialog()).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).isRenaming()).toBe(true);
    });

    it('should open confirmation dialog when delete button clicked', () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue([mockCustomPresets[0]]);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();

      // Call the method directly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onDeletePreset('custom-arcade-setup' as CustomPresetName);

      // Should open confirmation dialog
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showConfirmDialog()).toBe(true);
    });

    it('should open name dialog when save action clicked', () => {
      fixture.detectChanges();

      // Call the method directly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onSaveAsPreset();

      // Should open name dialog in save mode
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showNameDialog()).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).isRenaming()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Helper Method Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Helper Methods', () => {
    it('should strip custom- prefix from custom preset name', () => {
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (component as any).stripCustomPrefix('custom-my-preset' as CustomPresetName);
      expect(result).toBe('my-preset');
    });

    it('should return built-in names without default- prefix in reserved names', () => {
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reserved = (component as any).getReservedNames();
      
      // Should contain built-in names without 'default-' prefix
      expect(reserved).toContain('small-video-webgl');
      expect(reserved).toContain('large-video-webgl');
      expect(reserved).toContain('small-image-webgl');
      
      // Should NOT contain names with prefix
      expect(reserved).not.toContain('default-small-webgl');
    });

    it('should return custom names without custom- prefix in reserved names', () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reserved = (component as any).getReservedNames();
      
      // Should contain custom names without 'custom-' prefix
      expect(reserved).toContain('arcade-setup');
      expect(reserved).toContain('my-preset');
      
      // Should NOT contain names with prefix
      expect(reserved).not.toContain('custom-arcade-setup');
    });

    it('should combine built-in and custom names in reserved names', () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reserved = (component as any).getReservedNames();
      
      // Should have 3 built-in + 3 custom = 6 total
      expect(reserved.length).toBe(6);
    });

    it('should return custom preset label from getPresetLabel for custom presets', () => {
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const label = (component as any).getPresetLabel('custom-my-preset' as CustomPresetName);
      expect(label).toBe('my-preset');
    });

    it('should return built-in preset label from CRT_PRESET_LABELS for built-in presets', () => {
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const label = (component as any).getPresetLabel('default-large-video-webgl' as CrtPresetName);
      expect(label).toBe('Large Video (WebGL)');
    });

    it('should use currentPresetLabel input when provided for built-in presets', () => {
      fixture.componentRef.setInput('currentPresetLabel', 'Default');
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const label = (component as any).getPresetLabel('default-small-webgl' as CrtPresetName);
      expect(label).toBe('Default');
    });

    it('should still strip custom- prefix for custom presets regardless of currentPresetLabel', () => {
      fixture.componentRef.setInput('currentPresetLabel', 'Default');
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const label = (component as any).getPresetLabel('custom-test' as CustomPresetName);
      expect(label).toBe('test');
    });
  });

  describe('Save Preset Workflow', () => {
    it('should open name dialog when onSaveAsPreset is called', () => {
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onSaveAsPreset();
      
      // Dialog should be visible
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showNameDialog()).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).isRenaming()).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).dialogPresetName()).toBe('');
    });

    it('should save preset with valid name', () => {
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onSaveAsPreset();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onNameDialogConfirmed('Test Preset');
      
      // Should call storage service with correct params
      expect(mockCrtStorage.saveCustomPreset).toHaveBeenCalledWith('Test Preset', DEFAULT_CRT_SETTINGS);
      // Should refresh custom presets
      expect(mockCrtStorage.loadCustomPresets).toHaveBeenCalled();
      // Should close dialog
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showNameDialog()).toBe(false);
    });

    it('should not save preset when maximum limit reached', () => {
      // Mock 50 existing presets
      const maxPresets = Array.from({ length: 50 }, (_, i) => ({
        name: `custom-preset-${i}` as CustomPresetName,
        settings: DEFAULT_CRT_SETTINGS,
        createdAt: new Date().toISOString(),
      }));
      mockCrtStorage.loadCustomPresets.mockReturnValue(maxPresets);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onSaveAsPreset();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onNameDialogConfirmed('Test Preset');
      
      // Should NOT call save
      expect(mockCrtStorage.saveCustomPreset).not.toHaveBeenCalled();
      // Should close dialog
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showNameDialog()).toBe(false);
    });

    it('should handle save errors gracefully', () => {
      mockCrtStorage.saveCustomPreset.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onSaveAsPreset();
      
      // Should not throw
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (component as any).onNameDialogConfirmed('Test Preset');
      }).not.toThrow();
      
      // Dialog should still close
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showNameDialog()).toBe(false);
    });

    it('should close dialog when cancelled', () => {
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onSaveAsPreset();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showNameDialog()).toBe(true);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onNameDialogCancelled();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showNameDialog()).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).isRenaming()).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).dialogPresetName()).toBe('');
    });

    it('should refresh custom presets after save', () => {
      const updatedPresets = [...mockCustomPresets, {
        name: 'custom-new-preset' as CustomPresetName,
        settings: DEFAULT_CRT_SETTINGS,
        createdAt: new Date().toISOString(),
      }];
      
      // Reset all mocks first
      vi.clearAllMocks();
      
      // Setup mock to return empty first (constructor), then updated list (after save)
      let callCount = 0;
      mockCrtStorage.loadCustomPresets.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? [] : updatedPresets;
      });
      
      // Also need to reset saveCustomPreset to not throw error (vi.fn() returns undefined by default)
      mockCrtStorage.saveCustomPreset.mockImplementation(() => undefined);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).customPresets().length).toBe(0);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onSaveAsPreset();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onNameDialogConfirmed('New Preset');
      
      // Custom presets should be updated
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).customPresets().length).toBe(4);
    });
  });

  describe('Update Preset Workflow', () => {
    beforeEach(() => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      mockCrtStorage.updateCustomPreset = vi.fn();
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should update existing preset with current settings', () => {
      const presetName = 'custom-my-preset' as CustomPresetName;
      const newSettings = { ...DEFAULT_CRT_SETTINGS, brightness: 1.5 };
      fixture.componentRef.setInput('settings', newSettings);
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onUpdatePreset(presetName);
      
      // Should call storage service with preset name and current settings
      expect(mockCrtStorage.updateCustomPreset).toHaveBeenCalledWith(presetName, newSettings);
      // Should refresh custom presets
      expect(mockCrtStorage.loadCustomPresets).toHaveBeenCalled();
    });

    it('should handle updating preset without changing dropdown state', () => {
      const presetName = 'custom-arcade-setup' as CustomPresetName;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onUpdatePreset(presetName);
      
      // Dialog states should remain unchanged
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showNameDialog()).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).isRenaming()).toBe(false);
    });
  });

  describe('Rename Preset Workflow', () => {
    beforeEach(() => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should open name dialog with preset name when onRenamePreset is called', () => {
      const presetName = 'custom-my-preset' as CustomPresetName;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onRenamePreset(presetName);
      
      // Dialog should be visible in rename mode
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showNameDialog()).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).isRenaming()).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).dialogPresetName()).toBe(presetName);
    });

    it('should rename preset with valid new name', () => {
      const oldName = 'custom-my-preset' as CustomPresetName;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onRenamePreset(oldName);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onNameDialogConfirmed('Renamed Preset');
      
      // Should call storage service with old and new names
      expect(mockCrtStorage.renameCustomPreset).toHaveBeenCalledWith(oldName, 'Renamed Preset');
      // Should refresh custom presets
      expect(mockCrtStorage.loadCustomPresets).toHaveBeenCalled();
      // Should close dialog and reset state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showNameDialog()).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).isRenaming()).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).dialogPresetName()).toBe('');
    });

    it('should allow renaming to same name', () => {
      const presetName = 'custom-my-preset' as CustomPresetName;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onRenamePreset(presetName);
      
      // Get reserved names while renaming
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reserved = (component as any).getReservedNames();
      
      // Should NOT include current preset name
      expect(reserved).not.toContain('my-preset');
      // Should include other custom presets
      expect(reserved).toContain('arcade-setup');
    });

    it('should handle rename errors gracefully', () => {
      mockCrtStorage.renameCustomPreset.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const presetName = 'custom-my-preset' as CustomPresetName;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onRenamePreset(presetName);
      
      // Should not throw
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (component as any).onNameDialogConfirmed('New Name');
      }).not.toThrow();
      
      // Dialog should still close and reset
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showNameDialog()).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).isRenaming()).toBe(false);
    });
  });

  describe('Delete Preset Workflow', () => {
    beforeEach(() => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should open confirmation dialog when onDeletePreset is called', () => {
      const presetName = 'custom-my-preset' as CustomPresetName;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onDeletePreset(presetName);
      
      // Confirmation dialog should be visible
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showConfirmDialog()).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).dialogPresetName()).toBe(presetName);
    });

    it('should delete preset when confirmed', () => {
      const presetName = 'custom-my-preset' as CustomPresetName;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onDeletePreset(presetName);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onDeleteConfirmed();
      
      // Should call storage service
      expect(mockCrtStorage.deleteCustomPreset).toHaveBeenCalledWith(presetName);
      // Should refresh custom presets
      expect(mockCrtStorage.loadCustomPresets).toHaveBeenCalled();
      // Should close dialog
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showConfirmDialog()).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).dialogPresetName()).toBe('');
    });

    it('should emit presetSelected with default when active preset is deleted', () => {
      const presetName = 'custom-my-preset' as CustomPresetName;
      
      // Set component settings to match the preset we're about to delete
      fixture.componentRef.setInput('settings', mockCustomPresets[1].settings);
      fixture.detectChanges();
      
      const presetSelectedSpy = vi.fn();
      component.presetSelected.subscribe(presetSelectedSpy);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onDeletePreset(presetName);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onDeleteConfirmed();
      
      // Should emit presetSelected with default preset
      expect(presetSelectedSpy).toHaveBeenCalledWith(CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL);
    });

    it('should not emit presetSelected when non-active preset is deleted', () => {
      const presetName = 'custom-my-preset' as CustomPresetName;
      
      // Keep default settings (doesn't match any custom preset)
      fixture.detectChanges();
      
      const presetSelectedSpy = vi.fn();
      component.presetSelected.subscribe(presetSelectedSpy);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onDeletePreset(presetName);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onDeleteConfirmed();
      
      // Should NOT emit presetSelected
      expect(presetSelectedSpy).not.toHaveBeenCalled();
    });

    it('should close dialog when cancelled', () => {
      const presetName = 'custom-my-preset' as CustomPresetName;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onDeletePreset(presetName);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showConfirmDialog()).toBe(true);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onDeleteCancelled();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showConfirmDialog()).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).dialogPresetName()).toBe('');
      // Should NOT have called delete
      expect(mockCrtStorage.deleteCustomPreset).not.toHaveBeenCalled();
    });

    it('should generate correct confirmation message', () => {
      const presetName = 'custom-my-preset' as CustomPresetName;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onDeletePreset(presetName);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = (component as any).getConfirmationMessage();
      expect(message).toBe("Delete preset 'my-preset'? This action cannot be undone.");
    });

    it('should handle delete errors gracefully', () => {
      mockCrtStorage.deleteCustomPreset.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const presetName = 'custom-my-preset' as CustomPresetName;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onDeletePreset(presetName);
      
      // Should not throw
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (component as any).onDeleteConfirmed();
      }).not.toThrow();
      
      // Dialog should still close
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).showConfirmDialog()).toBe(false);
    });
  });

  describe('Dialog Integration', () => {
    it('should render name dialog when showNameDialog is true', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      
      // Initially no dialog
      let dialog = fixture.nativeElement.querySelector('lib-preset-name-dialog');
      expect(dialog).toBeNull();
      
      // Open dropdown first, then call save
      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      
      // Open dialog
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onSaveAsPreset();
      fixture.detectChanges();
      await fixture.whenStable();
      
      // Dialog should be rendered in dropdown content
      const overlay = document.querySelector('.cdk-overlay-container');
      dialog = overlay?.querySelector('lib-preset-name-dialog') || null;
      expect(dialog).toBeTruthy();
    });

    it('should render confirmation dialog when showConfirmDialog is true', async () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
      
      // Open dropdown first
      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      
      // Initially no dialog in overlay
      let overlay = document.querySelector('.cdk-overlay-container');
      let dialog = overlay?.querySelector('lib-confirmation-dialog');
      expect(dialog).toBeNull();
      
      // Open dialog
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onDeletePreset('custom-my-preset' as CustomPresetName);
      fixture.detectChanges();
      await fixture.whenStable();
      
      // Dialog should be rendered in overlay
      overlay = document.querySelector('.cdk-overlay-container');
      dialog = overlay?.querySelector('lib-confirmation-dialog');
      expect(dialog).toBeTruthy();
    });

    it('should pass correct title to name dialog for save', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      
      // Open dropdown first
      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onSaveAsPreset();
      fixture.detectChanges();
      await fixture.whenStable();
      
      const overlay = document.querySelector('.cdk-overlay-container');
      const dialog = overlay?.querySelector('lib-preset-name-dialog');
      expect(dialog?.getAttribute('ng-reflect-title')).toBe('Save Preset');
    });

    it('should pass correct title to name dialog for rename', async () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
      
      // Open dropdown first
      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onRenamePreset('custom-my-preset' as CustomPresetName);
      fixture.detectChanges();
      await fixture.whenStable();
      
      const overlay = document.querySelector('.cdk-overlay-container');
      const dialog = overlay?.querySelector('lib-preset-name-dialog');
      expect(dialog?.getAttribute('ng-reflect-title')).toBe('Rename Preset');
    });

    it('should pass empty initial value for save', () => {
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onSaveAsPreset();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const initialValue = (component as any).getDialogInitialValue();
      expect(initialValue).toBe('');
    });

    it('should pass preset name without prefix as initial value for rename', () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onRenamePreset('custom-my-preset' as CustomPresetName);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const initialValue = (component as any).getDialogInitialValue();
      expect(initialValue).toBe('my-preset');
    });

    it('should only render one dialog at a time', async () => {
      mockCrtStorage.loadCustomPresets.mockReturnValue(mockCustomPresets);
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
      
      // Open dropdown first
      const bookmarkButton = findIconButton(fixture.nativeElement, 'bookmark');
      bookmarkButton?.querySelector('button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      
      // Open name dialog
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onSaveAsPreset();
      fixture.detectChanges();
      await fixture.whenStable();
      
      let overlay = document.querySelector('.cdk-overlay-container');
      let nameDialog = overlay?.querySelector('lib-preset-name-dialog');
      let confirmDialog = overlay?.querySelector('lib-confirmation-dialog');
      
      expect(nameDialog).toBeTruthy();
      expect(confirmDialog).toBeNull();
      
      // Close name dialog and open confirmation dialog
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onNameDialogCancelled();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).onDeletePreset('custom-my-preset' as CustomPresetName);
      fixture.detectChanges();
      await fixture.whenStable();
      
      overlay = document.querySelector('.cdk-overlay-container');
      nameDialog = overlay?.querySelector('lib-preset-name-dialog');
      confirmDialog = overlay?.querySelector('lib-confirmation-dialog');
      
      expect(nameDialog).toBeNull();
      expect(confirmDialog).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty dialogPresetName when getting initial value', () => {
      fixture.detectChanges();
      
      // Manually set dialogPresetName to empty
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).dialogPresetName.set('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).isRenaming.set(true);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const initialValue = (component as any).getDialogInitialValue();
      expect(initialValue).toBe('');
    });

    it('should handle load errors in refreshCustomPresets', () => {
      mockCrtStorage.loadCustomPresets.mockImplementation(() => {
        throw new Error('Load error');
      });
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      
      // Should not throw during construction
      expect(() => fixture.detectChanges()).not.toThrow();
      
      // Custom presets should be empty array
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).customPresets()).toEqual([]);
    });

    it('should keep existing preset list when refresh fails', () => {
      mockCrtStorage.loadCustomPresets.mockReturnValueOnce(mockCustomPresets);
      
      fixture = createComponentFixture();
      component = fixture.componentInstance;
      fixture.detectChanges();
      
      // Should have loaded presets
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).customPresets().length).toBe(3);
      
      // Make next load fail
      mockCrtStorage.loadCustomPresets.mockImplementation(() => {
        throw new Error('Load error');
      });
      
      // Try to refresh
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any).refreshCustomPresets();
      
      // Should keep existing list
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((component as any).customPresets().length).toBe(3);
    });
  });
});

