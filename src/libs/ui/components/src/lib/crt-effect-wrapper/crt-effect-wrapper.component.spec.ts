import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { vi, Mock } from 'vitest';
import { CrtEffectWrapperComponent } from './crt-effect-wrapper.component';
import { CrtSettings } from './crt-settings.interface';
import { CRT_PRESETS, CRT_PRESET_KEYS, DEFAULT_CRT_SETTINGS } from './crt-settings.defaults';
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

    it('should have default settings matching CRT_PRESETS.large-video-webgl', () => {
      fixture.detectChanges();
      expect(component.settings()).toEqual(DEFAULT_CRT_SETTINGS);
      expect(component.settings()).toEqual(CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL]);
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
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.6');
    });

    it('should bind scanline-size CSS variable with px unit', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-size')).toBe('2.5px');
    });

    it('should bind vignette-strength CSS variable', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('1.5');
    });

    it('should bind screen-curvature CSS variable with px unit', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('115px');
    });

    it('should bind crt-contrast CSS variable', () => {
      fixture.detectChanges();
      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--crt-contrast')).toBe('1.15');
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

      // Update to minimal WebGL preset
      fixture.componentRef.setInput('settings', CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL]);
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
    it('should apply small preset with minimal effects', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL]);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.3');
      expect(wrapper.style.getPropertyValue('--scanline-size')).toBe('1.5px');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('0.7');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
    });

    it('should apply large preset with strong effects', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL]);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.6');
      expect(wrapper.style.getPropertyValue('--scanline-size')).toBe('2.5px');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('1.5');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('115px');
    });
  });

  describe('Effect Disabling via Settings', () => {
    it('should minimize effects when using small preset', () => {
      fixture.componentRef.setInput('settings', CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL]);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.3');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('0.7');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
    });

    it('should allow disabling individual effects by setting values to neutral', () => {
      // Custom settings with scanlines disabled (intensity=0) but other effects enabled
      const customSettings: CrtSettings = {
        ...CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL],
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
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('1.5');
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('115px');
    });

    it('should allow disabling curvature via settings', () => {
      // Small preset has curvature disabled
      fixture.componentRef.setInput('settings', CRT_PRESETS[CRT_PRESET_KEYS.SMALL_VIDEO_WEBGL]);
      fixture.detectChanges();

      const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
      // Curvature should be 0
      expect(wrapper.style.getPropertyValue('--screen-curvature')).toBe('0px');
      // Other effects should still be active
      expect(wrapper.style.getPropertyValue('--scanline-intensity')).toBe('0.3');
      expect(wrapper.style.getPropertyValue('--vignette-strength')).toBe('0.7');
    });

    it('should allow disabling color filters via neutral values', () => {
      const customSettings: CrtSettings = {
        ...CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL],
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

describe('CrtEffectWrapperComponent WebGL Mode', () => {
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
});

describe('CrtEffectWrapperComponent WebGL Video Support (mocked as supported)', () => {
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

  it('should detect video element and set it on renderer', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    // Manually trigger content detection (afterNextRender doesn't run in tests)
    // Access the child CrtEffectWrapperComponent
    const crtWrapperDebugElement = fixture.debugElement.query((de) => de.componentInstance instanceof CrtEffectWrapperComponent);
    const crtWrapper = crtWrapperDebugElement?.componentInstance;
    const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (crtWrapper as any).detectAndBindContent(wrapper);

    expect(mockRendererInstance.setVideoElement).toHaveBeenCalled();
    const video = mockRendererInstance.setVideoElement.mock.calls[0][0];
    expect(video).toBeInstanceOf(HTMLVideoElement);
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
  settings: CrtSettings = DEFAULT_CRT_SETTINGS;
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

  it('should detect image element and set it on renderer', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    // Manually trigger content detection (afterNextRender doesn't run in tests)
    // Access the child CrtEffectWrapperComponent
    const crtWrapperDebugElement = fixture.debugElement.query((de) => de.componentInstance instanceof CrtEffectWrapperComponent);
    const crtWrapper = crtWrapperDebugElement?.componentInstance;
    const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (crtWrapper as any).detectAndBindContent(wrapper);

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
    // Manually trigger content detection after refresh (afterNextRender doesn't run in tests)
    const wrapper = fixture.nativeElement.querySelector('.crt-wrapper');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (crtWrapper as any).detectAndBindContent(wrapper);
        // setImageElement should have been called again after refresh
    expect(mockRendererInstance.setImageElement.mock.calls.length).toBeGreaterThan(initialCallCount);
  });
});



