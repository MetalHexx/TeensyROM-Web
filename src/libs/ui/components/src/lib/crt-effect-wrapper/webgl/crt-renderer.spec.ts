import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CrtRenderer } from './crt-renderer';
import {
  createMockWebGLContext,
  createMockCanvas,
  MockWebGLContext,
  GL_CONSTANTS,
} from './webgl-context.mock';
import { CrtSettings } from '@teensyrom-nx/domain';

// Mock GPU detection classes manually
const mockDetectionPassRenderer = {
  renderEdgeDetection: vi.fn(),
  renderDetectionPasses: vi.fn(), // Added for integration tests
  readEdgeMeasurements: vi.fn(), // Returns edge measurements from edge map
  renderHorizontalScan: vi.fn(),
  renderVerticalScan: vi.fn(),
  getEdgeMapTexture: vi.fn(),
  getDepthMapTexture: vi.fn(),
  destroy: vi.fn(),
};

const mockEdgeAnalysisProcessor = {
  processCropResults: vi.fn(),
  reset: vi.fn(),
};

const mockVideoModeDetector = {
  detectMode: vi.fn(),
  reset: vi.fn(),
  getCurrentMode: vi.fn(() => null),
};

// Mock the module imports
vi.mock('./detection/detection-pass-renderer', () => ({
  DetectionPassRenderer: vi.fn(() => mockDetectionPassRenderer),
}));

vi.mock('./detection/edge-analysis-processor', () => ({
  EdgeAnalysisProcessor: vi.fn(() => mockEdgeAnalysisProcessor),
}));

vi.mock('./detection/video-mode-detector', () => ({
  VideoModeDetector: vi.fn(() => mockVideoModeDetector),
}));

describe('CrtRenderer', () => {
  let renderer: CrtRenderer;
  let mockGl: MockWebGLContext;
  let mockCanvas: HTMLCanvasElement;

  // Default test settings
  const testSettings: CrtSettings = {
    scanlineIntensity: 0.5,
    scanlineSize: 2.5,
    vignetteStrength: 1.0,
    screenCurvature: 0,
    contrast: 1.0,
    brightness: 1.0,
    saturation: 1.0,
    hue: 0,
    // Advanced effects (disabled for tests)
    phosphorPattern: 'none',
    phosphorIntensity: 0,
    bloomIntensity: 0,
    barrelDistortion: 0,
    chromaticAberration: 0,
    // Additional required properties
    monochromePhosphor: 'white',
    autoCropBlackBars: false,
    videoStandard: 'NTSC',
    videoMode: 'NTSC Standard',
  };

  beforeEach(() => {
    // Clear mock function history
    vi.clearAllMocks();

    // Reset mock return values - create mock textures for the detection pipeline
    const mockEdgeTexture = {} as WebGLTexture;
    const mockDepthTexture = {} as WebGLTexture;

    mockDetectionPassRenderer.getEdgeMapTexture.mockReturnValue(mockEdgeTexture);
    mockDetectionPassRenderer.getDepthMapTexture.mockReturnValue(mockDepthTexture);
    mockEdgeAnalysisProcessor.processCropResults.mockReturnValue(null);
    // Default: detectMode returns null (no stable detection)
    mockVideoModeDetector.detectMode.mockReturnValue(null);

    renderer = new CrtRenderer();
    mockGl = createMockWebGLContext();
    mockCanvas = createMockCanvas(mockGl);
  });

  afterEach(() => {
    renderer.destroy();
    vi.restoreAllMocks();
  });

  describe('isSupported', () => {
    it('should return true when WebGL is available', () => {
      // Mock document.createElement to return a canvas with working WebGL
      const mockSupportedCanvas = createMockCanvas(createMockWebGLContext());
      vi.spyOn(document, 'createElement').mockReturnValue(mockSupportedCanvas);

      expect(CrtRenderer.isSupported()).toBe(true);
    });

    it('should return false when WebGL is not available', () => {
      // Mock document.createElement to return a canvas without WebGL
      const mockUnsupportedCanvas = createMockCanvas(null);
      vi.spyOn(document, 'createElement').mockReturnValue(mockUnsupportedCanvas);

      expect(CrtRenderer.isSupported()).toBe(false);
    });

    it('should return false when getContext throws', () => {
      const mockErrorCanvas = document.createElement('canvas');
      vi.spyOn(mockErrorCanvas, 'getContext').mockImplementation(() => {
        throw new Error('WebGL not supported');
      });
      vi.spyOn(document, 'createElement').mockReturnValue(mockErrorCanvas);

      expect(CrtRenderer.isSupported()).toBe(false);
    });
  });

  describe('init', () => {
    it('should return true when initialization succeeds', () => {
      const result = renderer.init(mockCanvas);

      expect(result).toBe(true);
    });

    it('should return false when WebGL context is not available', () => {
      const noWebGLCanvas = createMockCanvas(null);

      const result = renderer.init(noWebGLCanvas);

      expect(result).toBe(false);
    });

    it('should compile vertex and fragment shaders', () => {
      renderer.init(mockCanvas);

      // Should create shaders for CRT effect only (detection pipeline is mocked)
      expect(mockGl._mocks.createShader).toHaveBeenCalledTimes(2);
      expect(mockGl._mocks.compileShader).toHaveBeenCalledTimes(2);
    });

    it('should create and link shader program', () => {
      renderer.init(mockCanvas);

      expect(mockGl._mocks.createProgram).toHaveBeenCalled();
      // Should attach shaders for CRT program only (detection pipeline is mocked)
      expect(mockGl._mocks.attachShader).toHaveBeenCalledTimes(2);
      expect(mockGl._mocks.linkProgram).toHaveBeenCalled();
    });

    it('should get uniform locations for all CRT settings', () => {
      renderer.init(mockCanvas);

      expect(mockGl._mocks.getUniformLocation).toHaveBeenCalledWith(
        expect.anything(),
        'u_scanlineIntensity'
      );
      expect(mockGl._mocks.getUniformLocation).toHaveBeenCalledWith(
        expect.anything(),
        'u_scanlineSize'
      );
      expect(mockGl._mocks.getUniformLocation).toHaveBeenCalledWith(
        expect.anything(),
        'u_vignetteStrength'
      );
      expect(mockGl._mocks.getUniformLocation).toHaveBeenCalledWith(
        expect.anything(),
        'u_screenCurvature'
      );
      expect(mockGl._mocks.getUniformLocation).toHaveBeenCalledWith(
        expect.anything(),
        'u_bloomIntensity'
      );
      expect(mockGl._mocks.getUniformLocation).toHaveBeenCalledWith(
        expect.anything(),
        'u_barrelDistortion'
      );
      expect(mockGl._mocks.getUniformLocation).toHaveBeenCalledWith(
        expect.anything(),
        'u_resolution'
      );
    });

    it('should disable blending for post-processing pipeline', () => {
      renderer.init(mockCanvas);

      expect(mockGl._mocks.disable).toHaveBeenCalledWith(GL_CONSTANTS.BLEND);
      // Should NOT call blendFunc since blending is disabled
      expect(mockGl._mocks.blendFunc).not.toHaveBeenCalled();
    });

    it('should set up vertex buffer', () => {
      renderer.init(mockCanvas);

      expect(mockGl._mocks.createBuffer).toHaveBeenCalled();
      expect(mockGl._mocks.bindBuffer).toHaveBeenCalled();
      expect(mockGl._mocks.bufferData).toHaveBeenCalled();
    });

    it('should return false when shader compilation fails', () => {
      const failingGl = createMockWebGLContext({ shaderCompileSuccess: false });
      const failingCanvas = createMockCanvas(failingGl);

      const result = renderer.init(failingCanvas);

      expect(result).toBe(false);
    });

    it('should return false when program linking fails', () => {
      const failingGl = createMockWebGLContext({ programLinkSuccess: false });
      const failingCanvas = createMockCanvas(failingGl);

      const result = renderer.init(failingCanvas);

      expect(result).toBe(false);
    });
  });

  describe('updateSettings', () => {
    beforeEach(() => {
      renderer.init(mockCanvas);
    });

    it('should update scanlineIntensity uniform', () => {
      renderer.updateSettings(testSettings);

      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.5);
    });

    it('should update scanlineSize uniform', () => {
      renderer.updateSettings(testSettings);

      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 2.5);
    });

    it('should update vignetteStrength uniform', () => {
      renderer.updateSettings(testSettings);

      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 1.0);
    });

    it('should use the shader program before updating uniforms', () => {
      renderer.updateSettings(testSettings);

      expect(mockGl._mocks.useProgram).toHaveBeenCalled();
    });

    it('should update barrelDistortion uniform', () => {
      const settingsWithDistortion: CrtSettings = {
        ...testSettings,
        barrelDistortion: 0.25,
      };

      renderer.updateSettings(settingsWithDistortion);

      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.25);
    });

    it('should update barrelDistortion when value changes', () => {
      // First update with 0.1
      renderer.updateSettings({ ...testSettings, barrelDistortion: 0.1 });
      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.1);

      // Clear mock to verify second update
      mockGl._mocks.uniform1f.mockClear();

      // Second update with 0.3
      renderer.updateSettings({ ...testSettings, barrelDistortion: 0.3 });
      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.3);
    });

    it('should handle barrelDistortion set to zero', () => {
      const settingsWithNoDistortion: CrtSettings = {
        ...testSettings,
        barrelDistortion: 0,
      };

      renderer.updateSettings(settingsWithNoDistortion);

      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 0);
    });

    it('should update bloomIntensity uniform', () => {
      const settingsWithBloom: CrtSettings = {
        ...testSettings,
        bloomIntensity: 0.5,
      };

      renderer.updateSettings(settingsWithBloom);

      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.5);
    });

    it('should update bloomIntensity when value changes', () => {
      // First update with 0.3
      renderer.updateSettings({ ...testSettings, bloomIntensity: 0.3 });
      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.3);

      // Clear mock to verify second update
      mockGl._mocks.uniform1f.mockClear();

      // Second update with 1.0
      renderer.updateSettings({ ...testSettings, bloomIntensity: 1.0 });
      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 1.0);
    });

    it('should handle bloomIntensity set to zero', () => {
      const settingsWithNoBloom: CrtSettings = {
        ...testSettings,
        bloomIntensity: 0,
      };

      renderer.updateSettings(settingsWithNoBloom);

      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 0);
    });

    it('should handle bloomIntensity at maximum value (2.0)', () => {
      const settingsWithMaxBloom: CrtSettings = {
        ...testSettings,
        bloomIntensity: 2.0,
      };

      renderer.updateSettings(settingsWithMaxBloom);

      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 2.0);
    });

    it('should not throw when called before init', () => {
      const uninitializedRenderer = new CrtRenderer();

      expect(() => uninitializedRenderer.updateSettings(testSettings)).not.toThrow();
    });
  });

  describe('render', () => {
    beforeEach(() => {
      renderer.init(mockCanvas);
    });

    it('should clear the canvas with opaque black', () => {
      renderer.render();

      expect(mockGl._mocks.clearColor).toHaveBeenCalledWith(0, 0, 0, 1);
      expect(mockGl._mocks.clear).toHaveBeenCalledWith(GL_CONSTANTS.COLOR_BUFFER_BIT);
    });

    it('should use the shader program', () => {
      renderer.render();

      expect(mockGl._mocks.useProgram).toHaveBeenCalled();
    });

    it('should bind vertex buffer and enable attribute', () => {
      renderer.render();

      expect(mockGl._mocks.bindBuffer).toHaveBeenCalled();
      expect(mockGl._mocks.enableVertexAttribArray).toHaveBeenCalled();
      expect(mockGl._mocks.vertexAttribPointer).toHaveBeenCalled();
    });

    it('should draw a fullscreen quad with triangle strip', () => {
      renderer.render();

      expect(mockGl._mocks.drawArrays).toHaveBeenCalledWith(
        GL_CONSTANTS.TRIANGLE_STRIP,
        0,
        4
      );
    });

    it('should not throw when called before init', () => {
      const uninitializedRenderer = new CrtRenderer();

      expect(() => uninitializedRenderer.render()).not.toThrow();
    });
  });

  describe('resize', () => {
    beforeEach(() => {
      renderer.init(mockCanvas);
    });

    it('should update canvas dimensions at device pixel ratio', () => {
      // Mock device pixel ratio
      vi.stubGlobal('devicePixelRatio', 2);

      renderer.resize(400, 300);

      expect(mockCanvas.width).toBe(800); // 400 * 2
      expect(mockCanvas.height).toBe(600); // 300 * 2
    });

    it('should set canvas CSS size to match container', () => {
      vi.stubGlobal('devicePixelRatio', 2);

      renderer.resize(400, 300);

      expect(mockCanvas.style.width).toBe('400px');
      expect(mockCanvas.style.height).toBe('300px');
    });

    it('should update viewport to match canvas size', () => {
      vi.stubGlobal('devicePixelRatio', 2);

      renderer.resize(400, 300);

      expect(mockGl._mocks.viewport).toHaveBeenCalledWith(0, 0, 800, 600);
    });

    it('should update resolution uniform', () => {
      vi.stubGlobal('devicePixelRatio', 2);

      renderer.resize(400, 300);

      expect(mockGl._mocks.uniform2f).toHaveBeenCalledWith(expect.anything(), 800, 600);
    });

    it('should handle devicePixelRatio of 1', () => {
      vi.stubGlobal('devicePixelRatio', 1);

      renderer.resize(400, 300);

      expect(mockCanvas.width).toBe(400);
      expect(mockCanvas.height).toBe(300);
    });

    it('should not throw when called before init', () => {
      const uninitializedRenderer = new CrtRenderer();

      expect(() => uninitializedRenderer.resize(400, 300)).not.toThrow();
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      renderer.init(mockCanvas);
    });

    it('should delete the vertex buffer', () => {
      renderer.destroy();

      expect(mockGl._mocks.deleteBuffer).toHaveBeenCalled();
    });

    it('should delete the shader program', () => {
      renderer.destroy();

      expect(mockGl._mocks.deleteProgram).toHaveBeenCalled();
    });

    it('should disable blending', () => {
      renderer.destroy();

      expect(mockGl._mocks.disable).toHaveBeenCalledWith(GL_CONSTANTS.BLEND);
    });

    it('should remove context loss event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(mockCanvas, 'removeEventListener');

      renderer.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('webglcontextlost', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'webglcontextrestored',
        expect.any(Function)
      );
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        renderer.destroy();
        renderer.destroy();
      }).not.toThrow();
    });

    it('should not throw when called before init', () => {
      const uninitializedRenderer = new CrtRenderer();

      expect(() => uninitializedRenderer.destroy()).not.toThrow();
    });
  });

  describe('context loss handling', () => {
    beforeEach(() => {
      renderer.init(mockCanvas);
    });

    it('should set up context loss event listeners', () => {
      const addEventListenerSpy = vi.spyOn(mockCanvas, 'addEventListener');

      // Re-init to capture the spy
      renderer.destroy();
      renderer = new CrtRenderer();
      renderer.init(mockCanvas);

      expect(addEventListenerSpy).toHaveBeenCalledWith('webglcontextlost', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'webglcontextrestored',
        expect.any(Function)
      );
    });

    it('should report context as not lost initially', () => {
      expect(renderer.isContextLost()).toBe(false);
    });

    it('should report context as lost after contextlost event', () => {
      const event = new Event('webglcontextlost');
      mockCanvas.dispatchEvent(event);

      expect(renderer.isContextLost()).toBe(true);
    });

    it('should prevent default on contextlost event', () => {
      const event = new Event('webglcontextlost', { cancelable: true });
      mockCanvas.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it('should not render when context is lost', () => {
      mockGl._mocks.drawArrays.mockClear();

      const event = new Event('webglcontextlost');
      mockCanvas.dispatchEvent(event);

      renderer.render();

      expect(mockGl._mocks.drawArrays).not.toHaveBeenCalled();
    });

    it('should not update settings when context is lost', () => {
      mockGl._mocks.uniform1f.mockClear();

      const event = new Event('webglcontextlost');
      mockCanvas.dispatchEvent(event);

      renderer.updateSettings(testSettings);

      expect(mockGl._mocks.uniform1f).not.toHaveBeenCalled();
    });
  });

  describe('phosphor pattern', () => {
    beforeEach(() => {
      renderer.init(mockCanvas);
    });

    it('should get phosphor uniform locations during init', () => {
      expect(mockGl._mocks.getUniformLocation).toHaveBeenCalledWith(
        expect.anything(),
        'u_phosphorPattern'
      );
      expect(mockGl._mocks.getUniformLocation).toHaveBeenCalledWith(
        expect.anything(),
        'u_phosphorIntensity'
      );
    });

    it('should set phosphor pattern to 0 when pattern is none', () => {
      renderer.updateSettings({
        ...testSettings,
        phosphorPattern: 'none',
        phosphorIntensity: 0,
      });

      expect(mockGl._mocks.uniform1i).toHaveBeenCalledWith(expect.anything(), 0);
    });

    it('should set phosphor pattern to 1 for aperture-grille', () => {
      renderer.updateSettings({
        ...testSettings,
        phosphorPattern: 'aperture-grille',
        phosphorIntensity: 0.5,
      });

      expect(mockGl._mocks.uniform1i).toHaveBeenCalledWith(expect.anything(), 1);
      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.5);
    });

    it('should set phosphor pattern to 2 for shadow-mask', () => {
      renderer.updateSettings({
        ...testSettings,
        phosphorPattern: 'shadow-mask',
        phosphorIntensity: 0.7,
      });

      expect(mockGl._mocks.uniform1i).toHaveBeenCalledWith(expect.anything(), 2);
      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.7);
    });

    it('should set phosphor pattern to 3 for dot-triad', () => {
      renderer.updateSettings({
        ...testSettings,
        phosphorPattern: 'dot-triad',
        phosphorIntensity: 1.0,
      });

      expect(mockGl._mocks.uniform1i).toHaveBeenCalledWith(expect.anything(), 3);
      expect(mockGl._mocks.uniform1f).toHaveBeenCalledWith(expect.anything(), 1.0);
    });

    it('should default to pattern 0 for unknown pattern values', () => {
      renderer.updateSettings({
        ...testSettings,
        // @ts-expect-error - Testing invalid pattern value
        phosphorPattern: 'invalid-pattern',
        phosphorIntensity: 0.5,
      });

      expect(mockGl._mocks.uniform1i).toHaveBeenCalledWith(expect.anything(), 0);
    });
  });

  describe('Video Texture Pipeline', () => {
    beforeEach(() => {
      renderer.init(mockCanvas);
    });

    it('should accept a video element via setVideoElement', () => {
      const mockVideo = document.createElement('video');
      
      // Should not throw
      expect(() => {
        renderer.setVideoElement(mockVideo);
      }).not.toThrow();
    });

    it('should start and stop render loop', () => {
      const rafSpy = vi.spyOn(global, 'requestAnimationFrame');
      const cafSpy = vi.spyOn(global, 'cancelAnimationFrame');

      renderer.startRenderLoop();
      expect(rafSpy).toHaveBeenCalled();

      renderer.stopRenderLoop();
      expect(cafSpy).toHaveBeenCalled();

      rafSpy.mockRestore();
      cafSpy.mockRestore();
    });

    it('should not start render loop if already running', () => {
      const rafSpy = vi.spyOn(global, 'requestAnimationFrame');

      renderer.startRenderLoop();
      const firstCallCount = rafSpy.mock.calls.length;

      renderer.startRenderLoop();
      const secondCallCount = rafSpy.mock.calls.length;

      // Should not call rAF again
      expect(secondCallCount).toBe(firstCallCount);

      renderer.stopRenderLoop();
      rafSpy.mockRestore();
    });

    it('should get videoTexture uniform location on init', () => {
      renderer.init(mockCanvas);

      expect(mockGl._mocks.getUniformLocation).toHaveBeenCalledWith(
        expect.anything(),
        'u_videoTexture'
      );
    });

    it('should clear to opaque black for post-processing output', () => {
      // Note: Blending is disabled for post-processing
      renderer.render();

      expect(mockGl._mocks.clearColor).toHaveBeenCalledWith(0, 0, 0, 1);
      expect(mockGl._mocks.clear).toHaveBeenCalledWith(GL_CONSTANTS.COLOR_BUFFER_BIT);
    });

    it('should stop render loop on destroy', () => {
      const cafSpy = vi.spyOn(global, 'cancelAnimationFrame');

      renderer.startRenderLoop();
      renderer.destroy();

      expect(cafSpy).toHaveBeenCalled();

      cafSpy.mockRestore();
    });
  });

  describe('GPU Detection Pipeline Integration (Phase 1.1)', () => {
    beforeEach(() => {
      // Initialize renderer with mock GL context
      renderer.init(mockCanvas);
      
      // Mock performance.now for throttling tests
      vi.useFakeTimers();
      vi.setSystemTime(0);
      
      // Ensure performance.now() also respects fake timers
      vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should not run detection when autoCropBlackBars is disabled', () => {
      const settingsDisabled: CrtSettings = { ...testSettings, autoCropBlackBars: false };
      renderer.updateSettings(settingsDisabled);

      // Create mock video texture
      const mockVideoTexture = mockGl.createTexture?.();
      if (mockVideoTexture) {
        (renderer as unknown as { videoTexture: WebGLTexture | null }).videoTexture = mockVideoTexture;
      }

      // Spy on detection pipeline methods
      const detectionPassRenderer = (renderer as unknown as {
        detectionPassRenderer: typeof mockDetectionPassRenderer | null;
      }).detectionPassRenderer;

      // Clear any previous calls from init
      if (detectionPassRenderer?.renderDetectionPasses) {
        vi.mocked(detectionPassRenderer.renderDetectionPasses).mockClear();
      }

      renderer.render();

      // Detection should not run
      if (detectionPassRenderer?.renderDetectionPasses) {
        expect(detectionPassRenderer.renderDetectionPasses).not.toHaveBeenCalled();
      }
    });

    it('should run detection when autoCropBlackBars is enabled and videoTexture exists', () => {
      // Set time for throttling logic
      vi.setSystemTime(0);

      // Enable detection BEFORE init to ensure settings are applied
      const settingsEnabled: CrtSettings = { ...testSettings, autoCropBlackBars: true };

      // Update settings after init (which sets up GL context)
      renderer.updateSettings(settingsEnabled);

      // Create mock video texture
      const mockVideoTexture = mockGl.createTexture?.() ?? {} as WebGLTexture;
      (renderer as unknown as { videoTexture: WebGLTexture | null }).videoTexture = mockVideoTexture;

      // Setup spy return values - match actual implementation flow
      mockDetectionPassRenderer.renderEdgeDetection.mockReturnValue(undefined);
      mockDetectionPassRenderer.readEdgeMeasurements.mockReturnValue({
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
      });

      renderer.render();

      // Actual implementation calls renderEdgeDetection
      expect(mockDetectionPassRenderer.renderEdgeDetection).toHaveBeenCalledWith(
        mockVideoTexture,
        mockCanvas.width,
        mockCanvas.height
      );
      // And then reads edge measurements
      expect(mockDetectionPassRenderer.readEdgeMeasurements).toHaveBeenCalled();
      // VideoModeDetector is called with edge measurements
      expect(mockVideoModeDetector.detectMode).toHaveBeenCalled();
    });

    it('should throttle detection to 200ms intervals (5 FPS)', () => {
      // Reset lastDetectionTime to ensure clean state (-1 = never detected)
      (renderer as unknown as { lastDetectionTime: number }).lastDetectionTime = -1;

      const settingsEnabled: CrtSettings = { ...testSettings, autoCropBlackBars: true };
      renderer.updateSettings(settingsEnabled);

      // Create mock video texture
      const mockVideoTexture = mockGl.createTexture?.() ?? {} as WebGLTexture;
      (renderer as unknown as { videoTexture: WebGLTexture | null }).videoTexture = mockVideoTexture;

      // Setup mock return values
      mockDetectionPassRenderer.renderEdgeDetection.mockReturnValue(undefined);
      mockDetectionPassRenderer.readEdgeMeasurements.mockReturnValue({
        left: 0, top: 0, right: 0, bottom: 0
      });

      // First render should run detection at t=0 (lastDetectionTime < 0)
      vi.setSystemTime(0);
      renderer.render();
      expect(mockDetectionPassRenderer.renderEdgeDetection).toHaveBeenCalledTimes(1);
      expect((renderer as unknown as { lastDetectionTime: number }).lastDetectionTime).toBe(0); // Should be set to current time

      // Render at 100ms (< 200ms since last at t=0) - should NOT run detection
      vi.setSystemTime(100);
      renderer.render();
      expect(mockDetectionPassRenderer.renderEdgeDetection).toHaveBeenCalledTimes(1); // Still 1

      // Render at 200ms (>= 200ms since last at t=0) - should run detection
      vi.setSystemTime(200);
      renderer.render();
      expect(mockDetectionPassRenderer.renderEdgeDetection).toHaveBeenCalledTimes(2); // Now 2

      // Render at 300ms (100ms since last at t=200) - should NOT run
      vi.setSystemTime(300);
      renderer.render();
      expect(mockDetectionPassRenderer.renderEdgeDetection).toHaveBeenCalledTimes(2); // Still 2

      // Render at 400ms (200ms since last at t=200) - should run
      vi.setSystemTime(400);
      renderer.render();
      expect(mockDetectionPassRenderer.renderEdgeDetection).toHaveBeenCalledTimes(3); // Now 3
    });

    it('should pass detected crops to CropAnimator', () => {
      vi.setSystemTime(0);

      const settingsEnabled: CrtSettings = { ...testSettings, autoCropBlackBars: true };
      renderer.updateSettings(settingsEnabled);

      // Create mock video texture
      const mockVideoTexture = mockGl.createTexture?.() ?? {} as WebGLTexture;
      (renderer as unknown as { videoTexture: WebGLTexture | null }).videoTexture = mockVideoTexture;

      // Setup mock return values for detection pipeline
      mockDetectionPassRenderer.renderEdgeDetection.mockReturnValue(undefined);
      mockDetectionPassRenderer.readEdgeMeasurements.mockReturnValue({
        left: 0, top: 0, right: 0, bottom: 0  // No black bars
      });

      const cropAnimator = (renderer as unknown as { cropAnimator: Record<string, ReturnType<typeof vi.fn>> }).cropAnimator;
      const mockCropRect = { left: 0.1, top: 0.2, width: 0.8, height: 0.6 };

      // Mock VideoModeDetector to return our test crop rect
      mockVideoModeDetector.detectMode.mockReturnValue(mockCropRect);
      const setTargetSpy = vi.spyOn(cropAnimator, 'setTarget');

      renderer.render();

      expect(setTargetSpy).toHaveBeenCalledWith(mockCropRect);
    });

    it('should reset detection pipeline when autoCropBlackBars is disabled', () => {
      const settingsEnabled: CrtSettings = { ...testSettings, autoCropBlackBars: true };
      renderer.updateSettings(settingsEnabled);

      const cropAnimator = (renderer as unknown as { cropAnimator: Record<string, ReturnType<typeof vi.fn>> }).cropAnimator;
      const resetAnimatorSpy = vi.spyOn(cropAnimator, 'reset');

      // Disable feature
      const settingsDisabled: CrtSettings = { ...testSettings, autoCropBlackBars: false };
      renderer.updateSettings(settingsDisabled);

      expect(resetAnimatorSpy).toHaveBeenCalled();
      // Note: EdgeAnalysisProcessor.reset may or may not be called depending on implementation
      expect((renderer as unknown as { lastDetectionTime: number }).lastDetectionTime).toBe(-1); // Reset to -1 (never detected)
    });

    it('should handle detection pipeline errors gracefully', () => {
      vi.setSystemTime(0);

      const settingsEnabled: CrtSettings = { ...testSettings, autoCropBlackBars: true };
      renderer.updateSettings(settingsEnabled);

      // Create mock video texture
      const mockVideoTexture = mockGl.createTexture?.() ?? {} as WebGLTexture;
      (renderer as unknown as { videoTexture: WebGLTexture | null }).videoTexture = mockVideoTexture;

      // Mock detection to throw error - use the actual method that's called
      mockDetectionPassRenderer.renderEdgeDetection.mockImplementation(() => {
        throw new Error('GPU detection error');
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Intentionally empty - just suppressing console output
      });

      // Should not throw, should continue rendering
      expect(() => renderer.render()).not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'CrtRenderer: Detection pipeline error:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('should clean up detection pipeline resources on destroy', () => {
      renderer.destroy();

      expect(mockDetectionPassRenderer.destroy).toHaveBeenCalled();
      expect((renderer as unknown as { detectionPassRenderer: typeof mockDetectionPassRenderer | null }).detectionPassRenderer).toBeNull();
    });
  });
});
