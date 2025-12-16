import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CrtRenderer } from './crt-renderer';
import {
  createMockWebGLContext,
  createMockCanvas,
  MockWebGLContext,
  GL_CONSTANTS,
} from './webgl-context.mock';
import { CrtSettings } from '@teensyrom-nx/domain';

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
    bloomEnabled: false,
    bloomIntensity: 0.3,
    bloomRadius: 3,
    barrelDistortion: 0,
    chromaticAberration: 0,
  };

  beforeEach(() => {
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

      // Should create two shaders (vertex and fragment)
      expect(mockGl._mocks.createShader).toHaveBeenCalledTimes(2);
      expect(mockGl._mocks.compileShader).toHaveBeenCalledTimes(2);
    });

    it('should create and link shader program', () => {
      renderer.init(mockCanvas);

      expect(mockGl._mocks.createProgram).toHaveBeenCalled();
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
});
