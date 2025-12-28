import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DetectionPassRenderer } from './detection-pass-renderer';
import {
  createMockWebGLContext,
  MockWebGLContext,
  GL_CONSTANTS,
} from '../webgl-context.mock';

describe('DetectionPassRenderer', () => {
  let renderer: DetectionPassRenderer;
  let mockGl: MockWebGLContext;

  beforeEach(() => {
    mockGl = createMockWebGLContext();
    renderer = new DetectionPassRenderer(mockGl as unknown as WebGLRenderingContext);
  });

  afterEach(() => {
    renderer.destroy();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create shader program during construction', () => {
      // Simplified implementation: only 1 program with 2 shaders (vertex + fragment)
      expect(mockGl._mocks.createShader).toHaveBeenCalledTimes(2);
      expect(mockGl._mocks.compileShader).toHaveBeenCalledTimes(2);
      expect(mockGl._mocks.createProgram).toHaveBeenCalled();
      expect(mockGl._mocks.linkProgram).toHaveBeenCalled();
    });

    it('should compile vertex shader successfully', () => {
      expect(mockGl._mocks.createShader).toHaveBeenCalledWith(GL_CONSTANTS.VERTEX_SHADER);
      expect(mockGl._mocks.shaderSource).toHaveBeenCalled();
      expect(mockGl._mocks.compileShader).toHaveBeenCalled();
    });

    it('should compile fragment shader successfully', () => {
      expect(mockGl._mocks.createShader).toHaveBeenCalledWith(GL_CONSTANTS.FRAGMENT_SHADER);
      expect(mockGl._mocks.shaderSource).toHaveBeenCalled();
      expect(mockGl._mocks.compileShader).toHaveBeenCalled();
    });

    it('should link shader program successfully', () => {
      // Simplified: only 1 program with 2 shaders
      expect(mockGl._mocks.attachShader).toHaveBeenCalledTimes(2);
      expect(mockGl._mocks.linkProgram).toHaveBeenCalled();
      expect(mockGl._mocks.getProgramParameter).toHaveBeenCalledWith(
        expect.anything(),
        GL_CONSTANTS.LINK_STATUS
      );
    });

    it('should get uniform locations for video texture and resolution', () => {
      expect(mockGl._mocks.getUniformLocation).toHaveBeenCalledWith(
        expect.anything(),
        'u_videoTexture'
      );
      expect(mockGl._mocks.getUniformLocation).toHaveBeenCalledWith(
        expect.anything(),
        'u_resolution'
      );
    });

    it('should get attribute location for vertex position', () => {
      expect(mockGl._mocks.getAttribLocation).toHaveBeenCalledWith(
        expect.anything(),
        'a_position'
      );
    });

    it('should create fullscreen quad vertex buffer', () => {
      expect(mockGl._mocks.createBuffer).toHaveBeenCalled();
      expect(mockGl._mocks.bindBuffer).toHaveBeenCalledWith(
        GL_CONSTANTS.ARRAY_BUFFER,
        expect.anything()
      );
      expect(mockGl._mocks.bufferData).toHaveBeenCalledWith(
        GL_CONSTANTS.ARRAY_BUFFER,
        expect.any(Float32Array),
        GL_CONSTANTS.STATIC_DRAW
      );
    });

    it('should throw error if shader program creation fails', () => {
      const failGl = createMockWebGLContext({ shaderCompileSuccess: false });

      expect(() => {
        new DetectionPassRenderer(failGl as unknown as WebGLRenderingContext);
      }).toThrow('[DetectionPassRenderer] Vertex shader compilation failed');
    });

    it('should throw error if program linking fails', () => {
      const failGl = createMockWebGLContext({ programLinkSuccess: false });

      expect(() => {
        new DetectionPassRenderer(failGl as unknown as WebGLRenderingContext);
      }).toThrow('[DetectionPassRenderer] Program linking failed');
    });

    it('should clean up shaders after linking program', () => {
      // Simplified: only 1 program with 2 shaders
      expect(mockGl._mocks.deleteShader).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Map Render Target', () => {
    let mockVideoTexture: WebGLTexture;

    beforeEach(() => {
      mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
    });

    it('should create edge map texture at 1/8 scale on first render', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);

      // Should create framebuffer and texture
      const createTextureCalls = mockGl._mocks.createTexture.mock.calls.length;
      expect(createTextureCalls).toBeGreaterThan(0);

      // Should set texture parameters
      expect(mockGl._mocks.texParameteri).toHaveBeenCalledWith(
        GL_CONSTANTS.TEXTURE_2D,
        GL_CONSTANTS.TEXTURE_MIN_FILTER,
        expect.anything()
      );
      expect(mockGl._mocks.texParameteri).toHaveBeenCalledWith(
        GL_CONSTANTS.TEXTURE_2D,
        GL_CONSTANTS.TEXTURE_MAG_FILTER,
        expect.anything()
      );
    });

    it('should create edge map at 1/8 scale for 320x240 video', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);

      // Expected dimensions: 320/8 = 40, 240/8 = 30
      expect(mockGl._mocks.texImage2D).toHaveBeenCalledWith(
        GL_CONSTANTS.TEXTURE_2D,
        0,
        GL_CONSTANTS.RGBA,
        40, // width / 8
        30, // height / 8
        0,
        GL_CONSTANTS.RGBA,
        GL_CONSTANTS.UNSIGNED_BYTE,
        null
      );
    });

    it('should create edge map at 1/8 scale for 640x480 video', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 640, 480);

      // Expected dimensions: 640/8 = 80, 480/8 = 60
      expect(mockGl._mocks.texImage2D).toHaveBeenCalledWith(
        GL_CONSTANTS.TEXTURE_2D,
        0,
        GL_CONSTANTS.RGBA,
        80, // width / 8
        60, // height / 8
        0,
        GL_CONSTANTS.RGBA,
        GL_CONSTANTS.UNSIGNED_BYTE,
        null
      );
    });

    it('should use NEAREST filtering for edge map (no interpolation)', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);

      // NEAREST filter for pixel-perfect sampling
      const nearestCalls = mockGl._mocks.texParameteri.mock.calls.filter(
        (call) =>
          call[1] === GL_CONSTANTS.TEXTURE_MIN_FILTER ||
          call[1] === GL_CONSTANTS.TEXTURE_MAG_FILTER
      );
      expect(nearestCalls.length).toBeGreaterThan(0);
    });

    it('should use CLAMP_TO_EDGE wrapping for edge map', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);

      expect(mockGl._mocks.texParameteri).toHaveBeenCalledWith(
        GL_CONSTANTS.TEXTURE_2D,
        GL_CONSTANTS.TEXTURE_WRAP_S,
        GL_CONSTANTS.CLAMP_TO_EDGE
      );
      expect(mockGl._mocks.texParameteri).toHaveBeenCalledWith(
        GL_CONSTANTS.TEXTURE_2D,
        GL_CONSTANTS.TEXTURE_WRAP_T,
        GL_CONSTANTS.CLAMP_TO_EDGE
      );
    });

    it('should reuse edge map if dimensions unchanged', () => {
      // First render
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      const firstCreateTextureCount = mockGl._mocks.createTexture.mock.calls.length;

      // Second render with same dimensions
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      const secondCreateTextureCount = mockGl._mocks.createTexture.mock.calls.length;

      // Should not create new texture
      expect(secondCreateTextureCount).toBe(firstCreateTextureCount);
    });

    it('should recreate edge map if dimensions change', () => {
      // First render
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      const firstCreateTextureCount = mockGl._mocks.createTexture.mock.calls.length;

      // Second render with different dimensions
      renderer.renderEdgeDetection(mockVideoTexture, 640, 480);
      const secondCreateTextureCount = mockGl._mocks.createTexture.mock.calls.length;

      // Should create new texture
      expect(secondCreateTextureCount).toBeGreaterThan(firstCreateTextureCount);
      
      // Should delete old texture
      expect(mockGl._mocks.deleteTexture).toHaveBeenCalled();
    });

    it('should handle minimum dimensions gracefully', () => {
      // Very small video should still create at least 1x1 texture
      renderer.renderEdgeDetection(mockVideoTexture, 4, 4);

      expect(mockGl._mocks.texImage2D).toHaveBeenCalledWith(
        GL_CONSTANTS.TEXTURE_2D,
        0,
        GL_CONSTANTS.RGBA,
        1, // max(1, 4/8) = 1
        1, // max(1, 4/8) = 1
        0,
        GL_CONSTANTS.RGBA,
        GL_CONSTANTS.UNSIGNED_BYTE,
        null
      );
    });
  });

  describe('Edge Detection Rendering', () => {
    let mockVideoTexture: WebGLTexture;

    beforeEach(() => {
      mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
    });

    it('should bind edge map framebuffer before rendering', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);

      // Should bind framebuffer (not null = custom framebuffer)
      const bindFramebufferCalls = mockGl._mocks.bindFramebuffer.mock.calls;
      const bindCustomFBO = bindFramebufferCalls.some(
        (call) => call[1] !== null
      );
      expect(bindCustomFBO).toBe(true);
    });

    it('should set viewport to edge map dimensions', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);

      // Expected viewport: 40x30 (1/8 scale of 320x240)
      expect(mockGl._mocks.viewport).toHaveBeenCalledWith(0, 0, 40, 30);
    });

    it('should use edge detection shader program', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);

      expect(mockGl._mocks.useProgram).toHaveBeenCalled();
    });

    it('should bind video texture to texture unit 0', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);

      expect(mockGl._mocks.activeTexture).toHaveBeenCalledWith(GL_CONSTANTS.TEXTURE0);
      expect(mockGl._mocks.bindTexture).toHaveBeenCalledWith(
        GL_CONSTANTS.TEXTURE_2D,
        mockVideoTexture
      );
    });

    it('should set video texture uniform to texture unit 0', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);

      expect(mockGl._mocks.uniform1i).toHaveBeenCalledWith(
        expect.anything(),
        0 // Texture unit 0
      );
    });

    it('should set resolution uniform to video dimensions', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);

      expect(mockGl._mocks.uniform2f).toHaveBeenCalledWith(
        expect.anything(),
        320,
        240
      );
    });

    it('should enable vertex attribute array', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);

      expect(mockGl._mocks.enableVertexAttribArray).toHaveBeenCalled();
    });

    it('should set up vertex attribute pointer', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);

      expect(mockGl._mocks.vertexAttribPointer).toHaveBeenCalledWith(
        expect.anything(), // position location
        2, // vec2
        GL_CONSTANTS.FLOAT,
        false, // no normalization
        0, // no stride
        0 // no offset
      );
    });

    it('should draw fullscreen quad with TRIANGLE_STRIP', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);

      expect(mockGl._mocks.drawArrays).toHaveBeenCalledWith(
        GL_CONSTANTS.TRIANGLE_STRIP,
        0,
        4 // 4 vertices for fullscreen quad
      );
    });

    it('should unbind framebuffer after rendering', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);

      // Should bind null framebuffer at the end (return to default)
      const bindFramebufferCalls = mockGl._mocks.bindFramebuffer.mock.calls;
      const lastCall = bindFramebufferCalls[bindFramebufferCalls.length - 1];
      expect(lastCall[1]).toBeNull();
    });

    it('should throw error if called before initialization completes', () => {
      // Create renderer with failing gl context
      const failGl = createMockWebGLContext();
      const failRenderer = new DetectionPassRenderer(failGl as unknown as WebGLRenderingContext);

      // Manually set program to null to simulate failed init
      ((failRenderer as unknown) as { program: WebGLProgram | null }).program = null;

      expect(() => {
        failRenderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      }).toThrow('[DetectionPassRenderer] Not initialized');

      failRenderer.destroy();
    });
  });


  describe('Texture Access', () => {
    let mockVideoTexture: WebGLTexture;

    beforeEach(() => {
      mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
    });

    it('should return null before first render', () => {
      const texture = renderer.getEdgeMapTexture();

      expect(texture).toBeNull();
    });

    it('should return edge map texture after rendering', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      const texture = renderer.getEdgeMapTexture();

      expect(texture).not.toBeNull();
      expect(texture).toHaveProperty('_type', 'WebGLTexture');
    });

    it('should return same texture on subsequent calls without re-render', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      const texture1 = renderer.getEdgeMapTexture();
      const texture2 = renderer.getEdgeMapTexture();

      expect(texture1).toBe(texture2);
    });
  });

  describe('Resource Cleanup', () => {
    let mockVideoTexture: WebGLTexture;

    beforeEach(() => {
      mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
    });

    it('should delete shader program on destroy', () => {
      renderer.destroy();

      expect(mockGl._mocks.deleteProgram).toHaveBeenCalled();
    });

    it('should delete vertex buffer on destroy', () => {
      renderer.destroy();

      expect(mockGl._mocks.deleteBuffer).toHaveBeenCalled();
    });

    it('should delete edge map texture on destroy if created', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      mockGl._mocks.deleteTexture.mockClear(); // Clear creation calls
      
      renderer.destroy();

      expect(mockGl._mocks.deleteTexture).toHaveBeenCalled();
    });

    it('should not throw if destroyed without rendering', () => {
      expect(() => {
        renderer.destroy();
      }).not.toThrow();
    });

    it('should be safe to call destroy multiple times', () => {
      renderer.destroy();
      
      expect(() => {
        renderer.destroy();
      }).not.toThrow();
    });

    it('should clean up all WebGL resources', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      mockGl._mocks.deleteProgram.mockClear();
      mockGl._mocks.deleteBuffer.mockClear();
      mockGl._mocks.deleteTexture.mockClear();
      
      renderer.destroy();

      // Verify all cleanup methods called
      expect(mockGl._mocks.deleteProgram).toHaveBeenCalled();
      expect(mockGl._mocks.deleteBuffer).toHaveBeenCalled();
      expect(mockGl._mocks.deleteTexture).toHaveBeenCalled();
    });
  });




  describe('Resource Cleanup (Task 01.1-002)', () => {
    it('should delete edge detection shader program on destroy', () => {
      renderer.destroy();

      // Only edge detection program exists (horizontal/vertical scan removed)
      expect(mockGl._mocks.deleteProgram).toHaveBeenCalledTimes(1);
    });

    // Note: Depth map tests removed - depth map functionality was simplified in Task 01.1-004

    it('should handle multiple destroy calls gracefully', () => {
      renderer.destroy();
      renderer.destroy(); // Should not throw

      // Only edge detection program exists (horizontal/vertical scan removed)
      expect(mockGl._mocks.deleteProgram).toHaveBeenCalledTimes(1);
    });
  });
});
