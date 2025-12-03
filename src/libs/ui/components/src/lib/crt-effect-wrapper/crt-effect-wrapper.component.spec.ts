import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { CrtEffectWrapperComponent } from './crt-effect-wrapper.component';
import { CrtSettings } from './crt-settings.interface';
import { CRT_PRESETS, DEFAULT_CRT_SETTINGS } from './crt-settings.defaults';

// Test host component for content projection testing
@Component({
  standalone: true,
  imports: [CrtEffectWrapperComponent],
  template: `
    <lib-crt-effect-wrapper [settings]="settings" [enabled]="enabled">
      <div class="projected-content">Test Content</div>
    </lib-crt-effect-wrapper>
  `,
})
class TestHostComponent {
  settings: CrtSettings = DEFAULT_CRT_SETTINGS;
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

    it('should bind scanline-size CSS variable with px unit', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-size')).toBe('2.5px');
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

    // Note: Phase 2 CSS custom properties (scanline-opacity, hue-rotate, color-temp,
    // vertical scanlines, and grid mode attributes) are bound in the template but
    // cannot be reliably tested in JSDOM. These features are tested through E2E tests.

    it('should update CSS variables when settings change', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');

      // Update to none preset
      fixture.componentRef.setInput('settings', CRT_PRESETS.none);
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

    it('should apply CRT_PRESETS.full with all effects enabled', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS.full);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.5');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('1.3');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('115px');
    });

    it('should apply CRT_PRESETS.standard with curvature disabled', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS.standard);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.5');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
      expect(wrapper.style.getPropertyValue('--crt-brightness')).toBe('1.5');
      expect(wrapper.style.getPropertyValue('--crt-saturation')).toBe('1.3');
    });

    it('should apply CRT_PRESETS.small with minimal scanlines', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS.small);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.5');
      expect(wrapper.style.getPropertyValue('--scanline-size')).toBe('1px');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
    });
  });

  describe('Effect Disabling via Settings', () => {
    it('should disable all effects when using CRT_PRESETS.none', () => {
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

    it('should allow disabling individual effects by setting values to neutral', () => {
      // Custom settings with scanlines disabled (intensity=0) but other effects enabled
      const customSettings: CrtSettings = {
        ...CRT_PRESETS.full,
        scanlineIntensity: 0,
        scanlineSize: 0,
      };
      fixture.componentRef.setInput('settings', customSettings);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      // Scanlines should be disabled
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0');
      expect(wrapper.style.getPropertyValue('--scanline-size')).toBe('0px');
      // Other effects should still be active
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('1.3');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('115px');
    });

    it('should allow disabling curvature via settings', () => {
      // Standard preset has curvature disabled
      fixture.componentRef.setInput('settings', CRT_PRESETS.standard);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      // Curvature should be 0
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
      // Other effects should still be active
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.5');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('1.3');
    });

    it('should allow disabling color filters via neutral values', () => {
      const customSettings: CrtSettings = {
        ...CRT_PRESETS.full,
        contrast: 1,
        brightness: 1,
        saturation: 1,
      };
      fixture.componentRef.setInput('settings', customSettings);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      // Color filters should be neutral (effectively disabled)
      expect(wrapper.style.getPropertyValue('--crt-contrast')).toBe('1');
      expect(wrapper.style.getPropertyValue('--crt-brightness')).toBe('1');
      expect(wrapper.style.getPropertyValue('--crt-saturation')).toBe('1');
      // Other effects should still be active
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.5');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('1.3');
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
