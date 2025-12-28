import { PASSTHROUGH_VERTEX_SHADER } from '../shaders/passthrough.vert';
import { edgeDetectFragmentShader } from './shaders';

/**
 * Uniform locations for edge detection shader.
 */
interface EdgeDetectUniforms {
  u_videoTexture: WebGLUniformLocation | null;
  u_resolution: WebGLUniformLocation | null;
}

/**
 * WebGL render pass for GPU-based black bar edge detection.
 *
 * Executes edge detection shader on a video texture, rendering to a 1/4 scale
 * framebuffer. The fragment shader samples all four edges in parallel and outputs
 * edge detection results as RGBA channels (left/top/right/bottom edge strengths).
 *
 * This approach eliminates the performance bottlenecks of Phase 1's CPU-based
 * detection which required 40+ gl.readPixels() calls per frame. GPU detection
 * runs all sampling in parallel with zero CPU stalls.
 *
 * Task 01.1-004 Simplification: Removed depth scanning shaders. Edge detection
 * is now used only to validate the presence of black bars. Cropping dimensions
 * are determined by C64 video mode presets (VideoModeDetector) instead of
 * variance-based GPU scanning.
 *
 * Performance Characteristics:
 * - Render resolution: 1/4 scale (e.g., 320x240 → 80x60)
 * - Shader executes 20 samples per edge per pixel
 * - Single gl.readPixels() call to retrieve results (4 bytes)
 * - Target overhead: < 3ms per detection pass
 *
 * @example
 * ```typescript
 * const renderer = new DetectionPassRenderer(gl);
 * renderer.renderEdgeDetection(videoTexture, 320, 240);
 * const measurements = renderer.readEdgeMeasurements();
 * ```
 */
export class DetectionPassRenderer {
  private program: WebGLProgram | null = null;
  private uniforms: EdgeDetectUniforms = {
    u_videoTexture: null,
    u_resolution: null,
  };

  // Render targets
  private edgeMapFBO: WebGLFramebuffer | null = null;
  private edgeMapTexture: WebGLTexture | null = null;
  private edgeMapWidth = 0;
  private edgeMapHeight = 0;

  // Vertex buffer (shared fullscreen quad)
  private vertexBuffer: WebGLBuffer | null = null;
  private positionLocation = -1;

  /**
   * Creates a new detection pass renderer.
   *
   * @param gl - WebGL rendering context
   */
  constructor(private gl: WebGLRenderingContext) {
    this.initialize();
  }

  /**
   * Initialize shader program and vertex buffer.
   */
  private initialize(): void {
    const gl = this.gl;

    // Compile edge detection shader program
    this.program = this.createProgram(
      PASSTHROUGH_VERTEX_SHADER,
      edgeDetectFragmentShader
    );

    if (!this.program) {
      throw new Error('[DetectionPassRenderer] Failed to create shader program');
    }

    // Get uniform locations
    this.uniforms.u_videoTexture = gl.getUniformLocation(this.program, 'u_videoTexture');
    this.uniforms.u_resolution = gl.getUniformLocation(this.program, 'u_resolution');

    // Get attribute location
    this.positionLocation = gl.getAttribLocation(this.program, 'a_position');

    // Create fullscreen quad vertex buffer
    this.vertexBuffer = gl.createBuffer();
    if (!this.vertexBuffer) {
      throw new Error('[DetectionPassRenderer] Failed to create vertex buffer');
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    // Fullscreen quad: two triangles forming a square from -1 to 1
    const vertices = new Float32Array([
      -1.0, -1.0, // Bottom-left
       1.0, -1.0, // Bottom-right
      -1.0,  1.0, // Top-left
       1.0,  1.0, // Top-right
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  /**
   * Create and compile a WebGL shader program.
   *
   * @param vertexSource - Vertex shader GLSL source
   * @param fragmentSource - Fragment shader GLSL source
   * @returns Compiled program or null on failure
   */
  private createProgram(
    vertexSource: string,
    fragmentSource: string
  ): WebGLProgram | null {
    const gl = this.gl;

    // Compile vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) return null;

    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(vertexShader);
      gl.deleteShader(vertexShader);
      throw new Error(`[DetectionPassRenderer] Vertex shader compilation failed: ${error}`);
    }

    // Compile fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
      gl.deleteShader(vertexShader);
      return null;
    }

    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(fragmentShader);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      throw new Error(`[DetectionPassRenderer] Fragment shader compilation failed: ${error}`);
    }

    // Link program
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // Clean up shaders (they're now in the program)
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`[DetectionPassRenderer] Program linking failed: ${error}`);
    }

    return program;
  }

  /**
   * Create or resize edge map render target.
   *
   * @param width - Video width
   * @param height - Video height
   */
  private ensureEdgeMapRenderTarget(width: number, height: number): void {
    const gl = this.gl;

    const targetWidth = Math.max(1, Math.floor(width / 8));
    const targetHeight = Math.max(1, Math.floor(height / 8));

    if (
      this.edgeMapTexture &&
      this.edgeMapWidth === targetWidth &&
      this.edgeMapHeight === targetHeight
    ) {
      return;
    }

    if (this.edgeMapTexture) {
      gl.deleteTexture(this.edgeMapTexture);
      this.edgeMapTexture = null;
    }
    if (this.edgeMapFBO) {
      gl.deleteFramebuffer(this.edgeMapFBO);
      this.edgeMapFBO = null;
    }

    this.edgeMapTexture = gl.createTexture();
    if (!this.edgeMapTexture) {
      throw new Error('[DetectionPassRenderer] Failed to create edge map texture');
    }

    gl.bindTexture(gl.TEXTURE_2D, this.edgeMapTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      targetWidth,
      targetHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.edgeMapFBO = gl.createFramebuffer();
    if (!this.edgeMapFBO) {
      gl.deleteTexture(this.edgeMapTexture);
      this.edgeMapTexture = null;
      throw new Error('[DetectionPassRenderer] Failed to create edge map framebuffer');
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgeMapFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.edgeMapTexture,
      0
    );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(this.edgeMapTexture);
      gl.deleteFramebuffer(this.edgeMapFBO);
      this.edgeMapTexture = null;
      this.edgeMapFBO = null;
      throw new Error(`[DetectionPassRenderer] Framebuffer incomplete: ${status}`);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.edgeMapWidth = targetWidth;
    this.edgeMapHeight = targetHeight;
  }

  /**
   * Execute edge detection render pass.
   *
   * Renders the edge detection shader to the edge map framebuffer, sampling
   * the provided video texture. Results are stored in the edge map texture
   * and can be retrieved via getEdgeMapTexture().
   *
   * @param videoTexture - Source video texture to analyze
   * @param videoWidth - Video width in pixels
   * @param videoHeight - Video height in pixels
   */
  renderEdgeDetection(
    videoTexture: WebGLTexture,
    videoWidth: number,
    videoHeight: number
  ): void {
    const gl = this.gl;

    if (!this.program || !this.vertexBuffer) {
      throw new Error('[DetectionPassRenderer] Not initialized');
    }

    this.ensureEdgeMapRenderTarget(videoWidth, videoHeight);

    if (!this.edgeMapFBO) {
      throw new Error('[DetectionPassRenderer] Edge map FBO not created');
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgeMapFBO);
    gl.viewport(0, 0, this.edgeMapWidth, this.edgeMapHeight);

    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);

    if (this.uniforms.u_videoTexture !== null) {
      gl.uniform1i(this.uniforms.u_videoTexture, 0);
    }
    if (this.uniforms.u_resolution !== null) {
      gl.uniform2f(this.uniforms.u_resolution, videoWidth, videoHeight);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Get the edge map texture containing detection results.
   *
   * The texture contains:
   * - R channel: Left edge strength (0.0 = content, 1.0 = black bar)
   * - G channel: Top edge strength
   * - B channel: Right edge strength
   * - A channel: Bottom edge strength
   *
   * @returns Edge map texture, or null if not yet rendered
   */
  getEdgeMapTexture(): WebGLTexture | null {
    return this.edgeMapTexture;
  }

  /**
   * Read edge detection measurements using brute-force CPU scanning.
   *
   * Scans every pixel along each edge to find the first non-black pixel.
   * This is simple, reliable, and comprehensive - no complex algorithms needed.
   *
   * Algorithm:
   * - Top edge: Scan from top down, row by row. Find first row with non-black pixels.
   * - Bottom edge: Scan from bottom up, row by row. Find first row with non-black pixels.
   * - Left edge: Scan from left right, column by column. Find first column with non-black pixels.
   * - Right edge: Scan from right left, column by column. Find first column with non-black pixels.
   *
   * Returns the fraction of each edge that is black (0-1).
   *
   * @returns Object with percentage measurements for each edge, or null if no edge map exists
   */
  readEdgeMeasurements(): { left: number; top: number; right: number; bottom: number } | null {
    const gl = this.gl;

    if (!this.edgeMapFBO || !this.edgeMapTexture) {
      return null;
    }

    const width = this.edgeMapWidth;
    const height = this.edgeMapHeight;

    const pixels = new Uint8Array(width * height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgeMapFBO);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const isBlackPixel = (idx: number, threshold = 20): boolean => {
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      return r < threshold && g < threshold && b < threshold;
    };

    let topBlackRows = 0;
    for (let y = 0; y < height; y++) {
      let rowHasNonBlack = false;
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (!isBlackPixel(idx)) {
          rowHasNonBlack = true;
          break;
        }
      }
      if (rowHasNonBlack) {
        break;
      }
      topBlackRows++;
    }

    let bottomBlackRows = 0;
    for (let y = height - 1; y >= 0; y--) {
      let rowHasNonBlack = false;
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (!isBlackPixel(idx)) {
          rowHasNonBlack = true;
          break;
        }
      }
      if (rowHasNonBlack) {
        break;
      }
      bottomBlackRows++;
    }

    let leftBlackCols = 0;
    for (let x = 0; x < width; x++) {
      let colHasNonBlack = false;
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        if (!isBlackPixel(idx)) {
          colHasNonBlack = true;
          break;
        }
      }
      if (colHasNonBlack) {
        break;
      }
      leftBlackCols++;
    }

    let rightBlackCols = 0;
    for (let x = width - 1; x >= 0; x--) {
      let colHasNonBlack = false;
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        if (!isBlackPixel(idx)) {
          colHasNonBlack = true;
          break;
        }
      }
      if (colHasNonBlack) {
        break;
      }
      rightBlackCols++;
    }

    const top = topBlackRows / height;
    const bottom = bottomBlackRows / height;
    const left = leftBlackCols / width;
    const right = rightBlackCols / width;

    return { left, top, right, bottom };
  }

  /**
   * Clean up WebGL resources.
   *
   * Must be called before disposing of the renderer to prevent memory leaks.
   */
  destroy(): void {
    const gl = this.gl;

    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }

    if (this.vertexBuffer) {
      gl.deleteBuffer(this.vertexBuffer);
      this.vertexBuffer = null;
    }

    if (this.edgeMapTexture) {
      gl.deleteTexture(this.edgeMapTexture);
      this.edgeMapTexture = null;
    }

    if (this.edgeMapFBO) {
      gl.deleteFramebuffer(this.edgeMapFBO);
      this.edgeMapFBO = null;
    }
  }
}
