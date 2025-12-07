import { vi } from 'vitest';

/**
 * WebGL constants for use in Node.js test environment where WebGLRenderingContext is not available.
 * These match the WebGL 1.0 specification values.
 */
export const GL_CONSTANTS = {
  VERTEX_SHADER: 35633,
  FRAGMENT_SHADER: 35632,
  COMPILE_STATUS: 35713,
  LINK_STATUS: 35714,
  ARRAY_BUFFER: 34962,
  STATIC_DRAW: 35044,
  FLOAT: 5126,
  TRIANGLE_STRIP: 5,
  COLOR_BUFFER_BIT: 16384,
  BLEND: 3042,
  SRC_ALPHA: 770,
  ONE_MINUS_SRC_ALPHA: 771,
  // Texture constants
  TEXTURE_2D: 3553,
  TEXTURE0: 33984,
  TEXTURE_WRAP_S: 10242,
  TEXTURE_WRAP_T: 10243,
  TEXTURE_MIN_FILTER: 10241,
  TEXTURE_MAG_FILTER: 10240,
  CLAMP_TO_EDGE: 33071,
  LINEAR: 9729,
  RGBA: 6408,
  UNSIGNED_BYTE: 5121,
} as const;

/**
 * Mock WebGL rendering context for unit testing.
 *
 * Provides stub implementations for all WebGL methods used by CrtRenderer.
 * Does not perform actual rendering - use for verifying method calls and
 * lifecycle behavior.
 *
 * @example
 * ```typescript
 * const canvas = document.createElement('canvas');
 * const mockGl = createMockWebGLContext();
 * vi.spyOn(canvas, 'getContext').mockReturnValue(mockGl);
 * ```
 */
export interface MockWebGLContext extends Partial<WebGLRenderingContext> {
  // Expose mocks for test assertions
  readonly _mocks: {
    createShader: ReturnType<typeof vi.fn>;
    shaderSource: ReturnType<typeof vi.fn>;
    compileShader: ReturnType<typeof vi.fn>;
    getShaderParameter: ReturnType<typeof vi.fn>;
    getShaderInfoLog: ReturnType<typeof vi.fn>;
    createProgram: ReturnType<typeof vi.fn>;
    attachShader: ReturnType<typeof vi.fn>;
    linkProgram: ReturnType<typeof vi.fn>;
    getProgramParameter: ReturnType<typeof vi.fn>;
    getProgramInfoLog: ReturnType<typeof vi.fn>;
    useProgram: ReturnType<typeof vi.fn>;
    deleteShader: ReturnType<typeof vi.fn>;
    deleteProgram: ReturnType<typeof vi.fn>;
    getUniformLocation: ReturnType<typeof vi.fn>;
    getAttribLocation: ReturnType<typeof vi.fn>;
    uniform1i: ReturnType<typeof vi.fn>;
    uniform1f: ReturnType<typeof vi.fn>;
    uniform2f: ReturnType<typeof vi.fn>;
    createBuffer: ReturnType<typeof vi.fn>;
    bindBuffer: ReturnType<typeof vi.fn>;
    bufferData: ReturnType<typeof vi.fn>;
    deleteBuffer: ReturnType<typeof vi.fn>;
    enableVertexAttribArray: ReturnType<typeof vi.fn>;
    disableVertexAttribArray: ReturnType<typeof vi.fn>;
    vertexAttribPointer: ReturnType<typeof vi.fn>;
    viewport: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    clearColor: ReturnType<typeof vi.fn>;
    enable: ReturnType<typeof vi.fn>;
    disable: ReturnType<typeof vi.fn>;
    blendFunc: ReturnType<typeof vi.fn>;
    drawArrays: ReturnType<typeof vi.fn>;
    getExtension: ReturnType<typeof vi.fn>;
    createTexture: ReturnType<typeof vi.fn>;
    bindTexture: ReturnType<typeof vi.fn>;
    texParameteri: ReturnType<typeof vi.fn>;
    texImage2D: ReturnType<typeof vi.fn>;
    deleteTexture: ReturnType<typeof vi.fn>;
    activeTexture: ReturnType<typeof vi.fn>;
  };
}

/**
 * Creates a mock WebGL context with all methods stubbed.
 *
 * @param options Configuration for mock behavior
 * @param options.shaderCompileSuccess Whether shader compilation succeeds (default: true)
 * @param options.programLinkSuccess Whether program linking succeeds (default: true)
 */
export function createMockWebGLContext(
  options: {
    shaderCompileSuccess?: boolean;
    programLinkSuccess?: boolean;
  } = {}
): MockWebGLContext {
  const { shaderCompileSuccess = true, programLinkSuccess = true } = options;

  // Create mock objects for shaders, programs, buffers
  const mockShader = { _type: 'WebGLShader' };
  const mockProgram = { _type: 'WebGLProgram' };
  const mockBuffer = { _type: 'WebGLBuffer' };
  const mockUniformLocation = { _type: 'WebGLUniformLocation' };

  // Track uniform location calls to return unique locations
  let uniformLocationCounter = 0;

  const mocks = {
    // Shader compilation
    createShader: vi.fn(() => mockShader),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn((shader, pname) => {
      if (pname === GL_CONSTANTS.COMPILE_STATUS) {
        return shaderCompileSuccess;
      }
      return null;
    }),
    getShaderInfoLog: vi.fn(() => (shaderCompileSuccess ? '' : 'Mock shader compilation error')),
    deleteShader: vi.fn(),

    // Program linking
    createProgram: vi.fn(() => mockProgram),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn((program, pname) => {
      if (pname === GL_CONSTANTS.LINK_STATUS) {
        return programLinkSuccess;
      }
      return null;
    }),
    getProgramInfoLog: vi.fn(() => (programLinkSuccess ? '' : 'Mock program link error')),
    useProgram: vi.fn(),
    deleteProgram: vi.fn(),

    // Uniforms and attributes
    getUniformLocation: vi.fn(() => ({ ...mockUniformLocation, _id: uniformLocationCounter++ })),
    getAttribLocation: vi.fn(() => 0),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),

    // Buffers
    createBuffer: vi.fn(() => mockBuffer),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    deleteBuffer: vi.fn(),

    // Vertex attributes
    enableVertexAttribArray: vi.fn(),
    disableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),

    // Rendering
    viewport: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    blendFunc: vi.fn(),
    drawArrays: vi.fn(),

    // Extensions
    getExtension: vi.fn(() => ({})), // Return truthy object for OES_standard_derivatives

    // Textures
    createTexture: vi.fn(() => ({ _type: 'WebGLTexture' })),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    deleteTexture: vi.fn(),
    activeTexture: vi.fn(),
  };

  // Create the mock context object
  const mockContext: MockWebGLContext = {
    // Expose mocks for assertions
    _mocks: mocks,

    // WebGL constants (use our local constants for Node.js compatibility)
    VERTEX_SHADER: GL_CONSTANTS.VERTEX_SHADER,
    FRAGMENT_SHADER: GL_CONSTANTS.FRAGMENT_SHADER,
    COMPILE_STATUS: GL_CONSTANTS.COMPILE_STATUS,
    LINK_STATUS: GL_CONSTANTS.LINK_STATUS,
    ARRAY_BUFFER: GL_CONSTANTS.ARRAY_BUFFER,
    STATIC_DRAW: GL_CONSTANTS.STATIC_DRAW,
    FLOAT: GL_CONSTANTS.FLOAT,
    TRIANGLE_STRIP: GL_CONSTANTS.TRIANGLE_STRIP,
    COLOR_BUFFER_BIT: GL_CONSTANTS.COLOR_BUFFER_BIT,
    BLEND: GL_CONSTANTS.BLEND,
    SRC_ALPHA: GL_CONSTANTS.SRC_ALPHA,
    ONE_MINUS_SRC_ALPHA: GL_CONSTANTS.ONE_MINUS_SRC_ALPHA,
    // Texture constants
    TEXTURE_2D: GL_CONSTANTS.TEXTURE_2D,
    TEXTURE0: GL_CONSTANTS.TEXTURE0,
    TEXTURE_WRAP_S: GL_CONSTANTS.TEXTURE_WRAP_S,
    TEXTURE_WRAP_T: GL_CONSTANTS.TEXTURE_WRAP_T,
    TEXTURE_MIN_FILTER: GL_CONSTANTS.TEXTURE_MIN_FILTER,
    TEXTURE_MAG_FILTER: GL_CONSTANTS.TEXTURE_MAG_FILTER,
    CLAMP_TO_EDGE: GL_CONSTANTS.CLAMP_TO_EDGE,
    LINEAR: GL_CONSTANTS.LINEAR,
    RGBA: GL_CONSTANTS.RGBA,
    UNSIGNED_BYTE: GL_CONSTANTS.UNSIGNED_BYTE,

    // Bind mock functions
    createShader: mocks.createShader as unknown as WebGLRenderingContext['createShader'],
    shaderSource: mocks.shaderSource as unknown as WebGLRenderingContext['shaderSource'],
    compileShader: mocks.compileShader as unknown as WebGLRenderingContext['compileShader'],
    getShaderParameter:
      mocks.getShaderParameter as unknown as WebGLRenderingContext['getShaderParameter'],
    getShaderInfoLog:
      mocks.getShaderInfoLog as unknown as WebGLRenderingContext['getShaderInfoLog'],
    deleteShader: mocks.deleteShader as unknown as WebGLRenderingContext['deleteShader'],
    createProgram: mocks.createProgram as unknown as WebGLRenderingContext['createProgram'],
    attachShader: mocks.attachShader as unknown as WebGLRenderingContext['attachShader'],
    linkProgram: mocks.linkProgram as unknown as WebGLRenderingContext['linkProgram'],
    getProgramParameter:
      mocks.getProgramParameter as unknown as WebGLRenderingContext['getProgramParameter'],
    getProgramInfoLog:
      mocks.getProgramInfoLog as unknown as WebGLRenderingContext['getProgramInfoLog'],
    useProgram: mocks.useProgram as unknown as WebGLRenderingContext['useProgram'],
    deleteProgram: mocks.deleteProgram as unknown as WebGLRenderingContext['deleteProgram'],
    getUniformLocation:
      mocks.getUniformLocation as unknown as WebGLRenderingContext['getUniformLocation'],
    getAttribLocation:
      mocks.getAttribLocation as unknown as WebGLRenderingContext['getAttribLocation'],
    uniform1i: mocks.uniform1i as unknown as WebGLRenderingContext['uniform1i'],
    uniform1f: mocks.uniform1f as unknown as WebGLRenderingContext['uniform1f'],
    uniform2f: mocks.uniform2f as unknown as WebGLRenderingContext['uniform2f'],
    createBuffer: mocks.createBuffer as unknown as WebGLRenderingContext['createBuffer'],
    bindBuffer: mocks.bindBuffer as unknown as WebGLRenderingContext['bindBuffer'],
    bufferData: mocks.bufferData as unknown as WebGLRenderingContext['bufferData'],
    deleteBuffer: mocks.deleteBuffer as unknown as WebGLRenderingContext['deleteBuffer'],
    enableVertexAttribArray:
      mocks.enableVertexAttribArray as unknown as WebGLRenderingContext['enableVertexAttribArray'],
    disableVertexAttribArray:
      mocks.disableVertexAttribArray as unknown as WebGLRenderingContext['disableVertexAttribArray'],
    vertexAttribPointer:
      mocks.vertexAttribPointer as unknown as WebGLRenderingContext['vertexAttribPointer'],
    viewport: mocks.viewport as unknown as WebGLRenderingContext['viewport'],
    clear: mocks.clear as unknown as WebGLRenderingContext['clear'],
    clearColor: mocks.clearColor as unknown as WebGLRenderingContext['clearColor'],
    enable: mocks.enable as unknown as WebGLRenderingContext['enable'],
    disable: mocks.disable as unknown as WebGLRenderingContext['disable'],
    blendFunc: mocks.blendFunc as unknown as WebGLRenderingContext['blendFunc'],
    drawArrays: mocks.drawArrays as unknown as WebGLRenderingContext['drawArrays'],
    getExtension: mocks.getExtension as unknown as WebGLRenderingContext['getExtension'],
    createTexture: mocks.createTexture as unknown as WebGLRenderingContext['createTexture'],
    bindTexture: mocks.bindTexture as unknown as WebGLRenderingContext['bindTexture'],
    texParameteri: mocks.texParameteri as unknown as WebGLRenderingContext['texParameteri'],
    texImage2D: mocks.texImage2D as unknown as WebGLRenderingContext['texImage2D'],
    deleteTexture: mocks.deleteTexture as unknown as WebGLRenderingContext['deleteTexture'],
    activeTexture: mocks.activeTexture as unknown as WebGLRenderingContext['activeTexture'],
  };

  return mockContext;
}

/**
 * Creates a mock canvas element with mocked getContext.
 *
 * @param mockGl The mock WebGL context to return from getContext
 */
export function createMockCanvas(mockGl: MockWebGLContext | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockImplementation((contextId: string) => {
    if (contextId === 'webgl' || contextId === 'experimental-webgl') {
      return mockGl as WebGLRenderingContext | null;
    }
    return null;
  });
  return canvas;
}
