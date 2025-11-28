import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { CrtEffectWrapperComponent } from './crt-effect-wrapper.component';
import { CrtSettings, CrtSettingsConfig } from './crt-settings.interface';
import {
  CRT_PRESETS,
  CRT_CONFIGS,
  DEFAULT_CRT_SETTINGS,
  DEFAULT_CRT_CONFIG,
} from './crt-settings.defaults';

// Test host component for content projection testing
@Component({
  standalone: true,
  imports: [CrtEffectWrapperComponent],
  template: `
    <lib-crt-effect-wrapper [settings]="settings" [config]="config" [enabled]="enabled">
      <div class="projected-content">Test Content</div>
    </lib-crt-effect-wrapper>
  `,
})
class TestHostComponent {
  settings: CrtSettings = DEFAULT_CRT_SETTINGS;
  config: CrtSettingsConfig = DEFAULT_CRT_CONFIG;
  enabled = true;
}

describe('CrtEffectWrapperComponent', () => {
  let component: CrtEffectWrapperComponent;
  let fixture: ComponentFixture<CrtEffectWrapperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrtEffectWrapperComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CrtEffectWrapperComponent);
    component = fixture.componentInstance;
  });

  describe('Component Creation', () => {
    it('should create successfully with default settings', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should have default settings matching CRT_PRESETS.full', () => {
      fixture.detectChanges();
      expect(component.settings()).toEqual(DEFAULT_CRT_SETTINGS);
      expect(component.settings()).toEqual(CRT_PRESETS.full);
    });

    it('should have default config with all features enabled', () => {
      fixture.detectChanges();
      expect(component.config()).toEqual(DEFAULT_CRT_CONFIG);
      expect(component.config().showScanlines).toBe(true);
      expect(component.config().showVignette).toBe(true);
      expect(component.config().showCurvature).toBe(true);
      expect(component.config().showColorFilters).toBe(true);
    });

    it('should be enabled by default', () => {
      fixture.detectChanges();
      expect(component.enabled()).toBe(true);
    });
  });

  describe('CSS Custom Properties', () => {
    it('should bind scanline-intensity CSS variable', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.5');
    });

    it('should bind scanline-thickness CSS variable with px unit', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-thickness')).toBe('3px');
    });

    it('should bind scanline-spacing CSS variable with px unit', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-spacing')).toBe('2px');
    });

    it('should bind vignette-strength CSS variable', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('1.3');
    });

    it('should bind screen-curvature CSS variable with px unit', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('115px');
    });

    it('should bind crt-contrast CSS variable', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--crt-contrast')).toBe('1.1');
    });

    it('should bind crt-brightness CSS variable', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--crt-brightness')).toBe('1.5');
    });

    it('should bind crt-saturation CSS variable', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--crt-saturation')).toBe('1.3');
    });

    it('should update CSS variables when settings change', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');

      // Update to filtersOnly preset
      fixture.componentRef.setInput('settings', CRT_PRESETS.filtersOnly);
      fixture.detectChanges();

      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('0');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
    });
  });

  describe('Enabled/Disabled State', () => {
    it('should have crt-enabled class when enabled is true', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.classList.contains('crt-enabled')).toBe(true);
    });

    it('should not have crt-enabled class when enabled is false', () => {
      fixture.componentRef.setInput('enabled', false);
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.classList.contains('crt-enabled')).toBe(false);
    });

    it('should toggle crt-enabled class when enabled changes', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');

      expect(wrapper.classList.contains('crt-enabled')).toBe(true);

      fixture.componentRef.setInput('enabled', false);
      fixture.detectChanges();
      expect(wrapper.classList.contains('crt-enabled')).toBe(false);

      fixture.componentRef.setInput('enabled', true);
      fixture.detectChanges();
      expect(wrapper.classList.contains('crt-enabled')).toBe(true);
    });
  });

  describe('Presets', () => {
    it('should apply CRT_PRESETS.none with all neutral values', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS.none);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('0');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
      expect(wrapper.style.getPropertyValue('--crt-contrast')).toBe('1');
      expect(wrapper.style.getPropertyValue('--crt-brightness')).toBe('1');
      expect(wrapper.style.getPropertyValue('--crt-saturation')).toBe('1');
    });

    it('should apply CRT_PRESETS.scanlines with vignette and curvature disabled', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS.scanlines);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.5');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('0');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
    });

    it('should apply CRT_PRESETS.filtersOnly with overlays disabled', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS.filtersOnly);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0');
      expect(wrapper.style.getPropertyValue('--crt-brightness')).toBe('1.5');
      expect(wrapper.style.getPropertyValue('--crt-saturation')).toBe('1.3');
    });
  });

  describe('Config Feature Flags', () => {
    it('should disable scanlines when config.showScanlines is false', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS.full);
      fixture.componentRef.setInput('config', { ...DEFAULT_CRT_CONFIG, showScanlines: false });
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0');
      expect(wrapper.style.getPropertyValue('--scanline-thickness')).toBe('0px');
      expect(wrapper.style.getPropertyValue('--scanline-spacing')).toBe('0px');
    });

    it('should disable vignette when config.showVignette is false', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS.full);
      fixture.componentRef.setInput('config', { ...DEFAULT_CRT_CONFIG, showVignette: false });
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('0');
    });

    it('should disable curvature when config.showCurvature is false', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS.full);
      fixture.componentRef.setInput('config', { ...DEFAULT_CRT_CONFIG, showCurvature: false });
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
    });

    it('should disable color filters when config.showColorFilters is false', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS.full);
      fixture.componentRef.setInput('config', { ...DEFAULT_CRT_CONFIG, showColorFilters: false });
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--crt-contrast')).toBe('1');
      expect(wrapper.style.getPropertyValue('--crt-brightness')).toBe('1');
      expect(wrapper.style.getPropertyValue('--crt-saturation')).toBe('1');
    });

    it('should apply CRT_CONFIGS.filtersOnly correctly', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS.full);
      fixture.componentRef.setInput('config', CRT_CONFIGS.filtersOnly);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      // Scanlines, vignette, curvature should be disabled
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('0');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
      // Color filters should still be active
      expect(wrapper.style.getPropertyValue('--crt-contrast')).toBe('1.1');
      expect(wrapper.style.getPropertyValue('--crt-brightness')).toBe('1.5');
    });

    it('should apply CRT_CONFIGS.scanlines correctly', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS.full);
      fixture.componentRef.setInput('config', CRT_CONFIGS.scanlines);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      // Scanlines should be active
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.5');
      // Vignette and curvature should be disabled
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('0');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
      // Color filters should be active
      expect(wrapper.style.getPropertyValue('--crt-brightness')).toBe('1.5');
    });

    it('should apply CRT_CONFIGS.none - all effects disabled', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS.full);
      fixture.componentRef.setInput('config', CRT_CONFIGS.none);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('0');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
      expect(wrapper.style.getPropertyValue('--crt-contrast')).toBe('1');
      expect(wrapper.style.getPropertyValue('--crt-brightness')).toBe('1');
      expect(wrapper.style.getPropertyValue('--crt-saturation')).toBe('1');
    });
  });
});

describe('CrtEffectWrapperComponent Content Projection', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
  });

  it('should project content into the wrapper', () => {
    fixture.detectChanges();

    const projectedContent = fixture.nativeElement.querySelector('.projected-content');
    expect(projectedContent).toBeTruthy();
    expect(projectedContent.textContent).toContain('Test Content');
  });

  it('should render projected content inside crt-content div', () => {
    fixture.detectChanges();

    const crtContent = fixture.nativeElement.querySelector('.crt-content');
    const projectedContent = crtContent.querySelector('.projected-content');
    expect(projectedContent).toBeTruthy();
  });

  it('should still project content when disabled', () => {
    hostComponent.enabled = false;
    fixture.detectChanges();

    const projectedContent = fixture.nativeElement.querySelector('.projected-content');
    expect(projectedContent).toBeTruthy();
    expect(projectedContent.textContent).toContain('Test Content');
  });
});
