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
      expect(mockGl._mocks.createShader).toHaveBeenCalledTimes(6); // Edge detect (2) + horizontal scan (2) + vertical scan (2)
      expect(mockGl._mocks.compileShader).toHaveBeenCalledTimes(6);
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
      expect(mockGl._mocks.attachShader).toHaveBeenCalledTimes(6); // 2 shaders per program × 3 programs
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
      // Shaders should be deleted after attaching to program (they're now in the program)
      expect(mockGl._mocks.deleteShader).toHaveBeenCalledTimes(6); // 2 shaders per program × 3 programs
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
      (failRenderer as any).program = null;

      expect(() => {
        failRenderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      }).toThrow('[DetectionPassRenderer] Not initialized');

      failRenderer.destroy();
    });
  });

  describe('Edge Results Reading', () => {
    let mockVideoTexture: WebGLTexture;

    beforeEach(() => {
      mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
      
      // Mock readPixels to return test data
      mockGl.readPixels = vi.fn((x, y, w, h, format, type, pixels) => {
        if (pixels instanceof Uint8Array) {
          // Simulate edge detection results: 50% black on all edges
          pixels[0] = 128; // Left edge: 50% (128/255)
          pixels[1] = 191; // Top edge: 75% (191/255)
          pixels[2] = 64;  // Right edge: 25% (64/255)
          pixels[3] = 255; // Bottom edge: 100% (255/255)
        }
      });
    });

    it('should return null if no edge map exists', () => {
      const results = renderer.readEdgeResults();

      expect(results).toBeNull();
    });

    it('should read edge detection results after rendering', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      const results = renderer.readEdgeResults();

      expect(results).not.toBeNull();
      expect(results).toHaveProperty('left');
      expect(results).toHaveProperty('top');
      expect(results).toHaveProperty('right');
      expect(results).toHaveProperty('bottom');
    });

    it('should convert pixel values from 0-255 to 0.0-1.0', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      const results = renderer.readEdgeResults();

      expect(results).not.toBeNull();
      if (results) {
        expect(results.left).toBeCloseTo(0.5, 2); // 128/255 ≈ 0.5
        expect(results.top).toBeCloseTo(0.75, 2); // 191/255 ≈ 0.75
        expect(results.right).toBeCloseTo(0.25, 2); // 64/255 ≈ 0.25
        expect(results.bottom).toBeCloseTo(1.0, 2); // 255/255 = 1.0
      }
    });

    it('should bind framebuffer before reading pixels', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      mockGl._mocks.bindFramebuffer.mockClear(); // Clear previous calls
      
      renderer.readEdgeResults();

      // Should bind custom framebuffer
      expect(mockGl._mocks.bindFramebuffer).toHaveBeenCalled();
    });

    it('should unbind framebuffer after reading pixels', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      mockGl._mocks.bindFramebuffer.mockClear(); // Clear previous calls
      
      renderer.readEdgeResults();

      // Should bind null framebuffer at the end
      const bindFramebufferCalls = mockGl._mocks.bindFramebuffer.mock.calls;
      const lastCall = bindFramebufferCalls[bindFramebufferCalls.length - 1];
      expect(lastCall[1]).toBeNull();
    });

    it('should read single pixel from edge map', () => {
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      renderer.readEdgeResults();

      expect(mockGl.readPixels).toHaveBeenCalledWith(
        0, // x
        0, // y
        1, // width = 1 pixel
        1, // height = 1 pixel
        GL_CONSTANTS.RGBA,
        GL_CONSTANTS.UNSIGNED_BYTE,
        expect.any(Uint8Array)
      );
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

  describe('Shader Algorithm Correctness', () => {
    it('should compile edge detection shader with correct constants', () => {
      // The shader source should contain our proven thresholds from Phase 1
      const shaderSourceCalls = mockGl._mocks.shaderSource.mock.calls;
      const fragmentShaderCall = shaderSourceCalls.find((call) =>
        call[1].includes('BLACK_LUMINANCE_THRESHOLD')
      );

      expect(fragmentShaderCall).toBeDefined();
      if (fragmentShaderCall) {
        const shaderSource = fragmentShaderCall[1];
        expect(shaderSource).toContain('BLACK_LUMINANCE_THRESHOLD = 0.05');
        expect(shaderSource).toContain('BLACK_SATURATION_THRESHOLD = 0.1');
        expect(shaderSource).toContain('SAMPLES_PER_EDGE = 20');
      }
    });

    it('should use HSV saturation calculation in shader', () => {
      const shaderSourceCalls = mockGl._mocks.shaderSource.mock.calls;
      const fragmentShaderCall = shaderSourceCalls.find((call) =>
        call[1].includes('calculateSaturation')
      );

      expect(fragmentShaderCall).toBeDefined();
      if (fragmentShaderCall) {
        const shaderSource = fragmentShaderCall[1];
        expect(shaderSource).toContain('calculateSaturation(vec3 rgb)');
        expect(shaderSource).toContain('maxVal - minVal'); // Saturation formula
      }
    });

    it('should use dual-threshold detection in shader', () => {
      const shaderSourceCalls = mockGl._mocks.shaderSource.mock.calls;
      const fragmentShaderCall = shaderSourceCalls.find((call) =>
        call[1].includes('luminance < BLACK_LUMINANCE_THRESHOLD')
      );

      expect(fragmentShaderCall).toBeDefined();
      if (fragmentShaderCall) {
        const shaderSource = fragmentShaderCall[1];
        // Should check BOTH luminance AND saturation
        expect(shaderSource).toContain('luminance < BLACK_LUMINANCE_THRESHOLD');
        expect(shaderSource).toContain('saturation < BLACK_SATURATION_THRESHOLD');
        expect(shaderSource).toMatch(/luminance.*&&.*saturation/);
      }
    });

    it('should encode edge results in RGBA channels', () => {
      const shaderSourceCalls = mockGl._mocks.shaderSource.mock.calls;
      const fragmentShaderCall = shaderSourceCalls.find((call) =>
        call[1].includes('gl_FragColor')
      );

      expect(fragmentShaderCall).toBeDefined();
      if (fragmentShaderCall) {
        const shaderSource = fragmentShaderCall[1];
        // Should output vec4 with leftEdge, topEdge, rightEdge, bottomEdge
        expect(shaderSource).toContain('gl_FragColor = vec4');
        expect(shaderSource).toContain('leftEdge');
        expect(shaderSource).toContain('topEdge');
        expect(shaderSource).toContain('rightEdge');
        expect(shaderSource).toContain('bottomEdge');
      }
    });
  });

  describe('Depth Scan Shader Programs (Task 01.1-002)', () => {
    it('should compile horizontal scan shader program during initialization', () => {
      // Should have compiled 6 shaders total:
      // - Edge detect: vertex + fragment (2)
      // - Horizontal scan: vertex + fragment (2)
      // - Vertical scan: vertex + fragment (2)
      expect(mockGl._mocks.createShader).toHaveBeenCalledTimes(6);
      expect(mockGl._mocks.compileShader).toHaveBeenCalledTimes(6);
    });

    it('should compile vertical scan shader program during initialization', () => {
      // Should have created 3 programs total
      expect(mockGl._mocks.createProgram).toHaveBeenCalledTimes(3);
      expect(mockGl._mocks.linkProgram).toHaveBeenCalledTimes(3);
    });

    it('should get uniform locations for horizontal scan shader', () => {
      const uniformCalls = mockGl._mocks.getUniformLocation.mock.calls;

      // Should request u_videoTexture, u_edgeMap, u_resolution for horizontal scan
      expect(uniformCalls.some((call) => call[1] === 'u_videoTexture')).toBe(true);
      expect(uniformCalls.some((call) => call[1] === 'u_edgeMap')).toBe(true);
      expect(uniformCalls.some((call) => call[1] === 'u_resolution')).toBe(true);
    });

    it('should get uniform locations for vertical scan shader', () => {
      const uniformCalls = mockGl._mocks.getUniformLocation.mock.calls;

      // Vertical scan has same uniforms as horizontal scan
      const videoTextureCalls = uniformCalls.filter((call) => call[1] === 'u_videoTexture');
      const edgeMapCalls = uniformCalls.filter((call) => call[1] === 'u_edgeMap');
      const resolutionCalls = uniformCalls.filter((call) => call[1] === 'u_resolution');

      // Should have 3 calls for each uniform (edge detect + horizontal + vertical)
      expect(videoTextureCalls.length).toBeGreaterThanOrEqual(3);
      expect(edgeMapCalls.length).toBeGreaterThanOrEqual(2); // Horizontal + vertical
      expect(resolutionCalls.length).toBeGreaterThanOrEqual(3);
    });

    it('should throw error if horizontal scan shader fails to compile', () => {
      const failGl = createMockWebGLContext({
        shaderCompileSuccess: false,
        failOnShaderIndex: 2, // Fail on 3rd shader (horizontal scan vertex)
      });

      expect(() => {
        new DetectionPassRenderer(failGl as unknown as WebGLRenderingContext);
      }).toThrow('[DetectionPassRenderer]');
    });
  });

  describe('Depth Map Render Target', () => {
    it('should create depth map render target on first scan render', () => {
      const mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
      const mockEdgeMapTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;

      // Depth map not created until first scan
      let createTextureCalls = mockGl._mocks.createTexture.mock.calls;
      const initialCount = createTextureCalls.length;

      // Trigger depth map creation
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      createTextureCalls = mockGl._mocks.createTexture.mock.calls;
      expect(createTextureCalls.length).toBeGreaterThan(initialCount);
    });

    it('should create 1x1 depth map texture on first scan', () => {
      const mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
      const mockEdgeMapTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;

      // Trigger depth map creation
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      // Depth map texture should exist
      const depthMapTexture = renderer.getDepthMapTexture();
      expect(depthMapTexture).not.toBe(null);
    });

    it('should create depth map framebuffer on first scan', () => {
      const mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
      const mockEdgeMapTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;

      const initialCount = mockGl._mocks.createFramebuffer.mock.calls.length;

      // Trigger depth map FBO creation
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.createFramebuffer).toHaveBeenCalledTimes(initialCount + 1);
    });

    it('should attach depth map texture to framebuffer on first scan', () => {
      const mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
      const mockEdgeMapTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;

      const initialCount = mockGl._mocks.framebufferTexture2D.mock.calls.length;

      // Trigger depth map attachment
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      const attachCalls = mockGl._mocks.framebufferTexture2D.mock.calls;
      expect(attachCalls.length).toBeGreaterThan(initialCount);

      // Depth map attachment should use COLOR_ATTACHMENT0
      const depthMapAttach = attachCalls[attachCalls.length - 1];
      expect(depthMapAttach[0]).toBe(GL_CONSTANTS.FRAMEBUFFER);
      expect(depthMapAttach[1]).toBe(GL_CONSTANTS.COLOR_ATTACHMENT0);
      expect(depthMapAttach[2]).toBe(GL_CONSTANTS.TEXTURE_2D);
    });

    it('should verify depth map framebuffer completeness on first scan', () => {
      const mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
      const mockEdgeMapTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;

      const initialCount = mockGl._mocks.checkFramebufferStatus.mock.calls.length;

      // Trigger depth map completeness check
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      const statusCalls = mockGl._mocks.checkFramebufferStatus.mock.calls;
      expect(statusCalls.length).toBeGreaterThan(initialCount);
      statusCalls.forEach((call) => {
        expect(call[0]).toBe(GL_CONSTANTS.FRAMEBUFFER);
      });
    });

    it('should use NEAREST filtering for depth map texture on first scan', () => {
      const mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
      const mockEdgeMapTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;

      const initialCount = mockGl._mocks.texParameteri.mock.calls.length;

      // Trigger depth map texture parameter setup
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      const paramCalls = mockGl._mocks.texParameteri.mock.calls;
      const newCalls = paramCalls.slice(initialCount);

      // Should have MIN_FILTER and MAG_FILTER set
      const filterCalls = newCalls.filter(
        (call) =>
          call[1] === GL_CONSTANTS.TEXTURE_MIN_FILTER ||
          call[1] === GL_CONSTANTS.TEXTURE_MAG_FILTER
      );
      expect(filterCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Horizontal Depth Scan Rendering', () => {
    let mockVideoTexture: WebGLTexture;
    let mockEdgeMapTexture: WebGLTexture;

    beforeEach(() => {
      mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
      mockEdgeMapTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;

      // First render edge detection to populate edge map
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      vi.clearAllMocks(); // Clear setup calls
    });

    it('should bind depth map framebuffer for horizontal scan', () => {
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.bindFramebuffer).toHaveBeenCalledWith(
        GL_CONSTANTS.FRAMEBUFFER,
        expect.anything()
      );
    });

    it('should set viewport to 1x1 for horizontal scan', () => {
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.viewport).toHaveBeenCalledWith(0, 0, 1, 1);
    });

    it('should use horizontal scan shader program', () => {
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      // Should call useProgram (once for horizontal scan)
      expect(mockGl._mocks.useProgram).toHaveBeenCalledWith(expect.anything());
    });

    it('should bind video texture to texture unit 0', () => {
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.activeTexture).toHaveBeenCalledWith(GL_CONSTANTS.TEXTURE0);
      expect(mockGl._mocks.bindTexture).toHaveBeenCalledWith(
        GL_CONSTANTS.TEXTURE_2D,
        mockVideoTexture
      );
    });

    it('should bind edge map texture to texture unit 1', () => {
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.activeTexture).toHaveBeenCalledWith(GL_CONSTANTS.TEXTURE1);
      expect(mockGl._mocks.bindTexture).toHaveBeenCalledWith(
        GL_CONSTANTS.TEXTURE_2D,
        mockEdgeMapTexture
      );
    });

    it('should set u_videoTexture uniform to texture unit 0', () => {
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.uniform1i).toHaveBeenCalledWith(expect.anything(), 0);
    });

    it('should set u_edgeMap uniform to texture unit 1', () => {
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.uniform1i).toHaveBeenCalledWith(expect.anything(), 1);
    });

    it('should set u_resolution uniform to video dimensions', () => {
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.uniform2f).toHaveBeenCalledWith(expect.anything(), 320, 240);
    });

    it('should draw fullscreen quad with TRIANGLE_STRIP', () => {
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.drawArrays).toHaveBeenCalledWith(
        GL_CONSTANTS.TRIANGLE_STRIP,
        0,
        4
      );
    });

    it('should unbind framebuffer after horizontal scan', () => {
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      const bindFramebufferCalls = mockGl._mocks.bindFramebuffer.mock.calls;
      const lastCall = bindFramebufferCalls[bindFramebufferCalls.length - 1];

      expect(lastCall[0]).toBe(GL_CONSTANTS.FRAMEBUFFER);
      expect(lastCall[1]).toBe(null);
    });

    it('should throw error if horizontal scan called before initialization', () => {
      const uninitializedGl = createMockWebGLContext();
      const uninitializedRenderer = new DetectionPassRenderer(
        uninitializedGl as unknown as WebGLRenderingContext
      );

      // Destroy to simulate uninitialized state
      uninitializedRenderer.destroy();

      expect(() => {
        uninitializedRenderer.renderHorizontalScan(
          mockVideoTexture,
          mockEdgeMapTexture,
          320,
          240
        );
      }).toThrow('[DetectionPassRenderer]');
    });
  });

  describe('Vertical Depth Scan Rendering', () => {
    let mockVideoTexture: WebGLTexture;
    let mockEdgeMapTexture: WebGLTexture;

    beforeEach(() => {
      mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
      mockEdgeMapTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;

      // First render edge detection to populate edge map
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      vi.clearAllMocks(); // Clear setup calls
    });

    it('should bind depth map framebuffer for vertical scan', () => {
      renderer.renderVerticalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.bindFramebuffer).toHaveBeenCalledWith(
        GL_CONSTANTS.FRAMEBUFFER,
        expect.anything()
      );
    });

    it('should set viewport to 1x1 for vertical scan', () => {
      renderer.renderVerticalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.viewport).toHaveBeenCalledWith(0, 0, 1, 1);
    });

    it('should use vertical scan shader program', () => {
      renderer.renderVerticalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.useProgram).toHaveBeenCalledWith(expect.anything());
    });

    it('should bind video texture to texture unit 0', () => {
      renderer.renderVerticalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.activeTexture).toHaveBeenCalledWith(GL_CONSTANTS.TEXTURE0);
      expect(mockGl._mocks.bindTexture).toHaveBeenCalledWith(
        GL_CONSTANTS.TEXTURE_2D,
        mockVideoTexture
      );
    });

    it('should bind edge map texture to texture unit 1', () => {
      renderer.renderVerticalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.activeTexture).toHaveBeenCalledWith(GL_CONSTANTS.TEXTURE1);
      expect(mockGl._mocks.bindTexture).toHaveBeenCalledWith(
        GL_CONSTANTS.TEXTURE_2D,
        mockEdgeMapTexture
      );
    });

    it('should set u_videoTexture uniform to texture unit 0', () => {
      renderer.renderVerticalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.uniform1i).toHaveBeenCalledWith(expect.anything(), 0);
    });

    it('should set u_edgeMap uniform to texture unit 1', () => {
      renderer.renderVerticalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.uniform1i).toHaveBeenCalledWith(expect.anything(), 1);
    });

    it('should set u_resolution uniform to video dimensions', () => {
      renderer.renderVerticalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.uniform2f).toHaveBeenCalledWith(expect.anything(), 320, 240);
    });

    it('should draw fullscreen quad with TRIANGLE_STRIP', () => {
      renderer.renderVerticalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      expect(mockGl._mocks.drawArrays).toHaveBeenCalledWith(
        GL_CONSTANTS.TRIANGLE_STRIP,
        0,
        4
      );
    });

    it('should unbind framebuffer after vertical scan', () => {
      renderer.renderVerticalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      const bindFramebufferCalls = mockGl._mocks.bindFramebuffer.mock.calls;
      const lastCall = bindFramebufferCalls[bindFramebufferCalls.length - 1];

      expect(lastCall[0]).toBe(GL_CONSTANTS.FRAMEBUFFER);
      expect(lastCall[1]).toBe(null);
    });

    it('should throw error if vertical scan called before initialization', () => {
      const uninitializedGl = createMockWebGLContext();
      const uninitializedRenderer = new DetectionPassRenderer(
        uninitializedGl as unknown as WebGLRenderingContext
      );

      // Destroy to simulate uninitialized state
      uninitializedRenderer.destroy();

      expect(() => {
        uninitializedRenderer.renderVerticalScan(
          mockVideoTexture,
          mockEdgeMapTexture,
          320,
          240
        );
      }).toThrow('[DetectionPassRenderer]');
    });
  });

  describe('Depth Map Texture Access', () => {
    it('should return depth map texture after first scan render', () => {
      const mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
      const mockEdgeMapTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;

      // Trigger depth map creation by rendering
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      const depthMapTexture = renderer.getDepthMapTexture();

      expect(depthMapTexture).toBeDefined();
      expect(depthMapTexture).not.toBe(null);
    });

    it('should return same depth map texture on multiple calls', () => {
      const mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
      const mockEdgeMapTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;

      // Trigger depth map creation
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      const texture1 = renderer.getDepthMapTexture();
      const texture2 = renderer.getDepthMapTexture();

      expect(texture1).toBe(texture2);
    });
  });

  describe('Depth Results Readback', () => {
    let mockVideoTexture: WebGLTexture;
    let mockEdgeMapTexture: WebGLTexture;

    beforeEach(() => {
      mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
      mockEdgeMapTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;

      // Setup: render edge detection, then depth scans
      renderer.renderEdgeDetection(mockVideoTexture, 320, 240);
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);
      renderer.renderVerticalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);
    });

    it('should bind depth map framebuffer before reading pixels', () => {
      vi.clearAllMocks();

      renderer.readDepthResults();

      expect(mockGl._mocks.bindFramebuffer).toHaveBeenCalledWith(
        GL_CONSTANTS.FRAMEBUFFER,
        expect.anything()
      );
    });

    it('should read single 1x1 pixel from depth map', () => {
      vi.clearAllMocks();

      renderer.readDepthResults();

      expect(mockGl._mocks.readPixels).toHaveBeenCalledWith(
        0, // x
        0, // y
        1, // width
        1, // height
        GL_CONSTANTS.RGBA,
        GL_CONSTANTS.UNSIGNED_BYTE,
        expect.any(Uint8Array)
      );
    });

    it('should return normalized depth values (0.0-1.0)', () => {
      // Set mock data before readPixels is called
      const originalReadPixels = mockGl.readPixels.bind(mockGl);
      mockGl.readPixels = vi.fn((...args: unknown[]) => {
        const buffer = args[6] as Uint8Array;
        buffer[0] = 50;   // Top
        buffer[1] = 100;  // Bottom
        buffer[2] = 150;  // Left
        buffer[3] = 200;  // Right
        originalReadPixels(...args);
      });

      const depths = renderer.readDepthResults();

      expect(depths).not.toBe(null);
      if (depths) {
        expect(depths.top).toBeCloseTo(50 / 255, 2);
        expect(depths.bottom).toBeCloseTo(100 / 255, 2);
        expect(depths.left).toBeCloseTo(150 / 255, 2);
        expect(depths.right).toBeCloseTo(200 / 255, 2);
      }
    });

    it('should return all zeros when no bars detected', () => {
      // Mock pixel data: all zeros
      mockGl._mockReadPixelsData = new Uint8Array([0, 0, 0, 0]);

      const depths = renderer.readDepthResults();

      expect(depths).not.toBe(null);
      if (depths) {
        expect(depths.top).toBe(0);
        expect(depths.bottom).toBe(0);
        expect(depths.left).toBe(0);
        expect(depths.right).toBe(0);
      }
    });

    it('should return maximum values when 50% bars detected', () => {
      // Set mock data for 50% bars (128 / 255 ≈ 0.5)
      const originalReadPixels = mockGl.readPixels.bind(mockGl);
      mockGl.readPixels = vi.fn((...args: unknown[]) => {
        const buffer = args[6] as Uint8Array;
        buffer[0] = 128;  // Top
        buffer[1] = 128;  // Bottom
        buffer[2] = 128;  // Left
        buffer[3] = 128;  // Right
        originalReadPixels(...args);
      });

      const depths = renderer.readDepthResults();

      expect(depths).not.toBe(null);
      if (depths) {
        expect(depths.top).toBeCloseTo(0.5, 1);
        expect(depths.bottom).toBeCloseTo(0.5, 1);
        expect(depths.left).toBeCloseTo(0.5, 1);
        expect(depths.right).toBeCloseTo(0.5, 1);
      }
    });

    it('should unbind framebuffer after reading pixels', () => {
      vi.clearAllMocks();

      renderer.readDepthResults();

      const bindFramebufferCalls = mockGl._mocks.bindFramebuffer.mock.calls;
      const lastCall = bindFramebufferCalls[bindFramebufferCalls.length - 1];

      expect(lastCall[0]).toBe(GL_CONSTANTS.FRAMEBUFFER);
      expect(lastCall[1]).toBe(null);
    });

    it('should return null if depth map not created', () => {
      const freshGl = createMockWebGLContext();
      const freshRenderer = new DetectionPassRenderer(
        freshGl as unknown as WebGLRenderingContext
      );

      // Destroy to simulate no depth map
      freshRenderer.destroy();

      const depths = freshRenderer.readDepthResults();

      expect(depths).toBe(null);
    });
  });

  describe('Shader Content Verification (Task 01.1-002)', () => {
    it('should include variance threshold constant in horizontal scan shader', () => {
      const shaderSourceCalls = mockGl._mocks.shaderSource.mock.calls;
      const horizontalShaderCall = shaderSourceCalls.find((call) =>
        call[1].includes('computeRowVariance')
      );

      expect(horizontalShaderCall).toBeDefined();
      if (horizontalShaderCall) {
        const shaderSource = horizontalShaderCall[1];
        expect(shaderSource).toContain('CONTENT_VARIANCE_THRESHOLD');
        expect(shaderSource).toContain('0.03'); // Variance threshold value
      }
    });

    it('should include variance calculation in horizontal scan shader', () => {
      const shaderSourceCalls = mockGl._mocks.shaderSource.mock.calls;
      const horizontalShaderCall = shaderSourceCalls.find((call) =>
        call[1].includes('computeRowVariance')
      );

      expect(horizontalShaderCall).toBeDefined();
      if (horizontalShaderCall) {
        const shaderSource = horizontalShaderCall[1];
        expect(shaderSource).toContain('computeRowVariance');
        expect(shaderSource).toContain('variance'); // Variance calculation
        expect(shaderSource).toContain('mean'); // Mean calculation
        expect(shaderSource).toContain('diff * diff'); // Squared differences
      }
    });

    it('should include top and bottom edge scanning in horizontal shader', () => {
      const shaderSourceCalls = mockGl._mocks.shaderSource.mock.calls;
      const horizontalShaderCall = shaderSourceCalls.find((call) =>
        call[1].includes('scanTopEdge')
      );

      expect(horizontalShaderCall).toBeDefined();
      if (horizontalShaderCall) {
        const shaderSource = horizontalShaderCall[1];
        expect(shaderSource).toContain('scanTopEdge');
        expect(shaderSource).toContain('scanBottomEdge');
        expect(shaderSource).toContain('MAX_SCAN_DEPTH_PERCENT');
      }
    });

    it('should include variance threshold constant in vertical scan shader', () => {
      const shaderSourceCalls = mockGl._mocks.shaderSource.mock.calls;
      const verticalShaderCall = shaderSourceCalls.find((call) =>
        call[1].includes('computeColumnVariance')
      );

      expect(verticalShaderCall).toBeDefined();
      if (verticalShaderCall) {
        const shaderSource = verticalShaderCall[1];
        expect(shaderSource).toContain('CONTENT_VARIANCE_THRESHOLD');
        expect(shaderSource).toContain('0.03'); // Variance threshold value
      }
    });

    it('should include variance calculation in vertical scan shader', () => {
      const shaderSourceCalls = mockGl._mocks.shaderSource.mock.calls;
      const verticalShaderCall = shaderSourceCalls.find((call) =>
        call[1].includes('computeColumnVariance')
      );

      expect(verticalShaderCall).toBeDefined();
      if (verticalShaderCall) {
        const shaderSource = verticalShaderCall[1];
        expect(shaderSource).toContain('computeColumnVariance');
        expect(shaderSource).toContain('variance'); // Variance calculation
        expect(shaderSource).toContain('mean'); // Mean calculation
        expect(shaderSource).toContain('diff * diff'); // Squared differences
      }
    });

    it('should include left and right edge scanning in vertical shader', () => {
      const shaderSourceCalls = mockGl._mocks.shaderSource.mock.calls;
      const verticalShaderCall = shaderSourceCalls.find((call) =>
        call[1].includes('scanLeftEdge')
      );

      expect(verticalShaderCall).toBeDefined();
      if (verticalShaderCall) {
        const shaderSource = verticalShaderCall[1];
        expect(shaderSource).toContain('scanLeftEdge');
        expect(shaderSource).toContain('scanRightEdge');
        expect(shaderSource).toContain('MAX_SCAN_DEPTH_PERCENT');
      }
    });

    it('should conditionally execute scans based on edge detection', () => {
      const shaderSourceCalls = mockGl._mocks.shaderSource.mock.calls;
      const horizontalShaderCall = shaderSourceCalls.find((call) =>
        call[1].includes('EDGE_DETECTION_THRESHOLD')
      );

      expect(horizontalShaderCall).toBeDefined();
      if (horizontalShaderCall) {
        const shaderSource = horizontalShaderCall[1];
        expect(shaderSource).toContain('EDGE_DETECTION_THRESHOLD');
        expect(shaderSource).toContain('0.7'); // 70% threshold
        expect(shaderSource).toContain('edges.'); // Reading edge map channels
      }
    });
  });

  describe('Resource Cleanup (Task 01.1-002)', () => {
    it('should delete depth scan shader programs on destroy', () => {
      renderer.destroy();

      // Should delete 3 programs: edge detect + horizontal scan + vertical scan
      expect(mockGl._mocks.deleteProgram).toHaveBeenCalledTimes(3);
    });

    it('should delete depth map texture on destroy if created', () => {
      const mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
      const mockEdgeMapTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;

      // Create depth map by rendering
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      renderer.destroy();

      // Should delete edge map + depth map textures
      expect(mockGl._mocks.deleteTexture).toHaveBeenCalled();
    });

    it('should delete depth map framebuffer on destroy if created', () => {
      const mockVideoTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;
      const mockEdgeMapTexture = { _type: 'WebGLTexture' } as unknown as WebGLTexture;

      // Create depth map by rendering
      renderer.renderHorizontalScan(mockVideoTexture, mockEdgeMapTexture, 320, 240);

      renderer.destroy();

      // Should delete edge map + depth map framebuffers
      expect(mockGl._mocks.deleteFramebuffer).toHaveBeenCalled();
    });

    it('should handle multiple destroy calls gracefully', () => {
      renderer.destroy();
      renderer.destroy(); // Should not throw

      expect(mockGl._mocks.deleteProgram).toHaveBeenCalledTimes(3);
    });
  });
});
