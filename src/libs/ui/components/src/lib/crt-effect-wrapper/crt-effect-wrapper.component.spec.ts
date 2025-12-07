import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { vi, Mock } from 'vitest';
import { CrtEffectWrapperComponent } from './crt-effect-wrapper.component';
import { CrtSettings } from './crt-settings.interface';
import { CRT_PRESETS, DEFAULT_CRT_SETTINGS } from './crt-settings.defaults';
import { CrtRenderer } from './webgl/crt-renderer';

// Mock CrtRenderer class - JSDOM doesn't have WebGL so we need to mock the entire class
const mockRendererInstance: {
  init: Mock;
  updateSettings: Mock;
  render: Mock;
  resize: Mock;
  destroy: Mock;
  isContextLost: Mock;
  setVideoElement: Mock;
  startRenderLoop: Mock;
  stopRenderLoop: Mock;
  setImageElement: Mock;
  renderImage: Mock;
} = {
  init: vi.fn(() => true),
  updateSettings: vi.fn(),
  render: vi.fn(),
  resize: vi.fn(),
  destroy: vi.fn(),
  isContextLost: vi.fn(() => false),
  setVideoElement: vi.fn(),
  startRenderLoop: vi.fn(),
  stopRenderLoop: vi.fn(),
  setImageElement: vi.fn(),
  renderImage: vi.fn(),
};

vi.mock('./webgl/crt-renderer', () => ({
  CrtRenderer: Object.assign(
    vi.fn(() => mockRendererInstance),
    { isSupported: vi.fn(() => false) }
  ),
}));

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

// Test host component with video element for WebGL mode testing
@Component({
  standalone: true,
  imports: [CrtEffectWrapperComponent],
  template: `
    <lib-crt-effect-wrapper [settings]="settings" [enabled]="enabled">
      <video #testVideo></video>
    </lib-crt-effect-wrapper>
  `,
})
class TestHostWithVideoComponent {
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

    it('should have default settings matching CRT_PRESETS.fullscreen-webgl', () => {
      fixture.detectChanges();
      expect(component.settings()).toEqual(DEFAULT_CRT_SETTINGS);
      expect(component.settings()).toEqual(CRT_PRESETS['fullscreen-webgl']);
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

      // Update to minimal CSS preset
      fixture.componentRef.setInput('settings', CRT_PRESETS['image-css']);
      fixture.detectChanges();

      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.3');
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
    it('should apply minimal CRT effects for images', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS['image-css']);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.3');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('0.7');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
      expect(wrapper.style.getPropertyValue('--crt-contrast')).toBe('1.05');
      expect(wrapper.style.getPropertyValue('--crt-brightness')).toBe('1.3');
      expect(wrapper.style.getPropertyValue('--crt-saturation')).toBe('1.15');
    });

    it('should apply CRT_PRESETS.fullscreen-webgl with strong effects', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS['fullscreen-webgl']);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.6');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('1.5');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('115px');
    });

    it('should apply CRT_PRESETS.dialog-webgl with moderate effects', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS['dialog-webgl']);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.4');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
      expect(wrapper.style.getPropertyValue('--crt-brightness')).toBe('1.4');
      expect(wrapper.style.getPropertyValue('--crt-saturation')).toBe('1.2');
    });

    it('should apply CRT_PRESETS.image-webgl with subtle scanlines', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS['image-webgl']);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.3');
      expect(wrapper.style.getPropertyValue('--scanline-size')).toBe('1.5px');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
    });
  });

  describe('Effect Disabling via Settings', () => {
    it('should minimize effects when using minimal intensity preset', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS['image-css']);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.3');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('0.7');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
      expect(wrapper.style.getPropertyValue('--crt-contrast')).toBe('1.05');
      expect(wrapper.style.getPropertyValue('--crt-brightness')).toBe('1');
      expect(wrapper.style.getPropertyValue('--crt-saturation')).toBe('1');
    });

    it('should allow disabling individual effects by setting values to neutral', () => {
      // Custom settings with scanlines disabled (intensity=0) but other effects enabled
      const customSettings: CrtSettings = {
        ...CRT_PRESETS['fullscreen-webgl'],
        scanlineIntensity: 0.8,
        scanlineSize: 0,
      };
      fixture.componentRef.setInput('settings', customSettings);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      // Scanlines should be disabled
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0');
      expect(wrapper.style.getPropertyValue('--scanline-size')).toBe('0px');
      // Other effects should still be active
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('1.5');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('115px');
    });

    it('should allow disabling curvature via settings', () => {
      // Dialog preset has curvature disabled
      fixture.componentRef.setInput('settings', CRT_PRESETS['dialog-webgl']);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      // Curvature should be 0
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
      // Other effects should still be active
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.4');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('1');
    });

    it('should allow disabling color filters via neutral values', () => {
      const customSettings: CrtSettings = {
        ...CRT_PRESETS['fullscreen-webgl'],
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
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.6');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('1.5');
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

describe('CrtEffectWrapperComponent Render Mode', () => {
  let component: CrtEffectWrapperComponent;
  let fixture: ComponentFixture<CrtEffectWrapperComponent>;

  beforeEach(async () => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    vi.mocked(CrtRenderer.isSupported).mockReturnValue(false);
    mockRendererInstance.init.mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [CrtEffectWrapperComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CrtEffectWrapperComponent);
    component = fixture.componentInstance;
  });

  describe('Canvas Element', () => {
    it('should have canvas element in DOM', () => {
      fixture.detectChanges();
      const canvas = fixture.nativeElement.querySelector('.webgl-canvas');
      expect(canvas).toBeTruthy();
    });

    it('should have canvas with correct class', () => {
      fixture.detectChanges();
      const canvas = fixture.nativeElement.querySelector('canvas.webgl-canvas');
      expect(canvas).toBeTruthy();
    });
  });

  describe('Mode Detection (WebGL not supported)', () => {
    beforeEach(() => {
      vi.mocked(CrtRenderer.isSupported).mockReturnValue(false);
    });

    it('should use CSS mode when webgl is requested but not supported', async () => {
      // Default preset has renderMode: 'webgl' but WebGL not supported
      fixture.detectChanges();
      await fixture.whenStable();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.classList.contains('mode-css')).toBe(true);
      expect(wrapper.classList.contains('mode-webgl')).toBe(false);
    });

    it('should use CSS mode when webgl is explicitly requested but not supported', async () => {
      const settings: CrtSettings = {
        ...DEFAULT_CRT_SETTINGS,
        renderMode: 'webgl',
      };
      fixture.componentRef.setInput('settings', settings);
      fixture.detectChanges();
      await fixture.whenStable();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.classList.contains('mode-css')).toBe(true);
    });

    it('should use CSS mode when css is explicitly requested', async () => {
      const settings: CrtSettings = {
        ...DEFAULT_CRT_SETTINGS,
        renderMode: 'css',
      };
      fixture.componentRef.setInput('settings', settings);
      fixture.detectChanges();
      await fixture.whenStable();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.classList.contains('mode-css')).toBe(true);
    });
  });

  describe('Mode Class Application', () => {
    it('should apply mode-css class in CSS mode', async () => {
      vi.mocked(CrtRenderer.isSupported).mockReturnValue(false);
      fixture.detectChanges();
      await fixture.whenStable();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.classList.contains('mode-css')).toBe(true);
    });

    it('should have render mode class on wrapper element', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      // Should have either mode-css or mode-webgl class
      const hasRenderModeClass =
        wrapper.classList.contains('mode-css') || wrapper.classList.contains('mode-webgl');
      expect(hasRenderModeClass).toBe(true);
    });
  });

  describe('Settings with renderMode', () => {
    it('should accept settings with renderMode property', () => {
      const settings: CrtSettings = {
        ...DEFAULT_CRT_SETTINGS,
        renderMode: 'css',
      };
      fixture.componentRef.setInput('settings', settings);
      fixture.detectChanges();

      expect(component.settings().renderMode).toBe('css');
    });

    it('should accept settings with webgl renderMode', () => {
      const settings: CrtSettings = {
        ...DEFAULT_CRT_SETTINGS,
        renderMode: 'webgl',
      };
      fixture.componentRef.setInput('settings', settings);
      fixture.detectChanges();

      expect(component.settings().renderMode).toBe('webgl');
    });

    it('should change mode when settings renderMode changes', async () => {
      // Start with CSS mode
      const cssSettings: CrtSettings = {
        ...DEFAULT_CRT_SETTINGS,
        renderMode: 'css',
      };
      fixture.componentRef.setInput('settings', cssSettings);
      fixture.detectChanges();
      await fixture.whenStable();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.classList.contains('mode-css')).toBe(true);

      // Change to webgl (falls back to CSS because WebGL not supported in test env)
      const webglSettings: CrtSettings = {
        ...DEFAULT_CRT_SETTINGS,
        renderMode: 'webgl',
      };
      fixture.componentRef.setInput('settings', webglSettings);
      fixture.detectChanges();
      await fixture.whenStable();

      // Should still be CSS mode since WebGL not supported in test
      expect(wrapper.classList.contains('mode-css')).toBe(true);
    });
  });

  describe('Fallback Behavior', () => {
    it('should gracefully fall back to CSS when WebGL not available', async () => {
      vi.mocked(CrtRenderer.isSupported).mockReturnValue(false);

      const settings: CrtSettings = {
        ...DEFAULT_CRT_SETTINGS,
        renderMode: 'webgl',
      };
      fixture.componentRef.setInput('settings', settings);
      fixture.detectChanges();
      await fixture.whenStable();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      // Should fall back to CSS mode
      expect(wrapper.classList.contains('mode-css')).toBe(true);
      expect(wrapper.classList.contains('mode-webgl')).toBe(false);
    });

    it('should still apply CSS effects in fallback mode', async () => {
      vi.mocked(CrtRenderer.isSupported).mockReturnValue(false);
      fixture.detectChanges();
      await fixture.whenStable();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      // CSS effects should still work
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.5');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('1.3');
    });
  });
});

describe('CrtEffectWrapperComponent WebGL Mode (mocked as supported)', () => {
  let fixture: ComponentFixture<TestHostWithVideoComponent>;
  let hostComponent: TestHostWithVideoComponent;

  beforeEach(async () => {
    // Reset all mocks and set WebGL as supported for these tests
    vi.clearAllMocks();
    vi.mocked(CrtRenderer.isSupported).mockReturnValue(true);
    mockRendererInstance.init.mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [TestHostWithVideoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostWithVideoComponent);
    hostComponent = fixture.componentInstance;
  });

  it('should use WebGL mode when auto is requested and WebGL is supported with video content', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    // Second change detection to pick up hasVideoContent signal change
    fixture.detectChanges();
    await fixture.whenStable();

    const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
    expect(wrapper.classList.contains('mode-webgl')).toBe(true);
    expect(wrapper.classList.contains('mode-css')).toBe(false);
  });

  it('should use WebGL mode when webgl is explicitly requested and supported with video content', async () => {
    const settings: CrtSettings = {
      ...DEFAULT_CRT_SETTINGS,
      renderMode: 'webgl',
    };
    hostComponent.settings = settings;
    fixture.detectChanges();
    await fixture.whenStable();
    // Second change detection to pick up hasVideoContent signal change
    fixture.detectChanges();
    await fixture.whenStable();

    const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
    expect(wrapper.classList.contains('mode-webgl')).toBe(true);
  });

  it('should use CSS mode when css is explicitly requested even if WebGL supported', async () => {
    const settings: CrtSettings = {
      ...DEFAULT_CRT_SETTINGS,
      renderMode: 'css',
    };
    hostComponent.settings = settings;
    fixture.detectChanges();
    await fixture.whenStable();

    const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
    expect(wrapper.classList.contains('mode-css')).toBe(true);
    expect(wrapper.classList.contains('mode-webgl')).toBe(false);
  });

  it('should detect video element and set it on renderer', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    // Second change detection to ensure afterNextRender has run
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockRendererInstance.setVideoElement).toHaveBeenCalled();
    const video = mockRendererInstance.setVideoElement.mock.calls[0][0];
    expect(video).toBeInstanceOf(HTMLVideoElement);
  });
});

describe('CrtEffectWrapperComponent CSS Fallback for Non-Video Content', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    // Reset all mocks and set WebGL as supported
    vi.clearAllMocks();
    vi.mocked(CrtRenderer.isSupported).mockReturnValue(true);
    mockRendererInstance.init.mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
  });

  it('should fall back to CSS mode when no video element is found even if WebGL is supported', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
    // Without video content, should fall back to CSS mode
    expect(wrapper.classList.contains('mode-css')).toBe(true);
    expect(wrapper.classList.contains('mode-webgl')).toBe(false);
  });

  it('should still apply CSS effects for image content', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
    expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.5');
    expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('1.3');
  });
});

// Test host component with cycling images for image refresh testing
@Component({
  standalone: true,
  imports: [CrtEffectWrapperComponent],
  template: `
    <lib-crt-effect-wrapper #crtWrapper [settings]="settings">
      <div class="image-container">
        @if (showImage) {
          <img class="carousel-image current" [src]="currentImageSrc" alt="Test image" />
        }
      </div>
    </lib-crt-effect-wrapper>
  `,
})
class TestHostWithImageComponent {
  settings: CrtSettings = { ...DEFAULT_CRT_SETTINGS, renderMode: 'webgl' };
  showImage = true;
  currentImageSrc = 'image1.jpg';
}

describe('CrtEffectWrapperComponent Image Cycling (refreshImage)', () => {
  let fixture: ComponentFixture<TestHostWithImageComponent>;
  let hostComponent: TestHostWithImageComponent;

  beforeEach(async () => {
    // Reset all mocks and set WebGL as supported for image mode testing
    vi.clearAllMocks();
    vi.mocked(CrtRenderer.isSupported).mockReturnValue(true);
    mockRendererInstance.init.mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [TestHostWithImageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostWithImageComponent);
    hostComponent = fixture.componentInstance;
  });

  it('should detect image element and enter WebGL image mode', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    // Additional render cycle for afterNextRender
    fixture.detectChanges();
    await fixture.whenStable();

    const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
    expect(wrapper.classList.contains('mode-webgl')).toBe(true);
    expect(mockRendererInstance.setImageElement).toHaveBeenCalled();
  });

  it('should call refreshImage without errors', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    // Get reference to CRT wrapper component
    const crtWrapper = fixture.debugElement.children[0].componentInstance as CrtEffectWrapperComponent;

    // Should not throw when calling refreshImage
    expect(() => crtWrapper.refreshImage()).not.toThrow();
  });

  it('should not error when refreshImage is called before renderer is ready', () => {
    // Don't call detectChanges - component not fully initialized
    const component = TestBed.createComponent(CrtEffectWrapperComponent).componentInstance;

    // Should not throw even without renderer
    expect(() => component.refreshImage()).not.toThrow();
  });

  it('should handle rapid refreshImage calls without errors', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const crtWrapper = fixture.debugElement.children[0].componentInstance as CrtEffectWrapperComponent;

    // Simulate rapid cycling - multiple refreshImage calls in quick succession
    expect(() => {
      crtWrapper.refreshImage();
      crtWrapper.refreshImage();
      crtWrapper.refreshImage();
    }).not.toThrow();
  });

  it('should not error when component is destroyed during refresh', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const crtWrapper = fixture.debugElement.children[0].componentInstance as CrtEffectWrapperComponent;

    // Call refreshImage then immediately destroy
    crtWrapper.refreshImage();
    expect(() => fixture.destroy()).not.toThrow();
  });

  it('should handle image source changes via refreshImage', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const crtWrapper = fixture.debugElement.children[0].componentInstance as CrtEffectWrapperComponent;
    const initialCallCount = mockRendererInstance.setImageElement.mock.calls.length;

    // Change image source and trigger refresh
    hostComponent.currentImageSrc = 'image2.jpg';
    fixture.detectChanges();
    crtWrapper.refreshImage();
    fixture.detectChanges();
    await fixture.whenStable();

    // setImageElement should have been called again after refresh
    expect(mockRendererInstance.setImageElement.mock.calls.length).toBeGreaterThan(initialCallCount);
  });
});
