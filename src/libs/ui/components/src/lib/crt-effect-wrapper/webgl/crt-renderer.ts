import { CrtSettings } from '@teensyrom-nx/domain';
import { PASSTHROUGH_VERTEX_SHADER } from './shaders/passthrough.vert';
import { SCANLINE_FRAGMENT_SHADER } from './shaders/scanline.frag';

/**
 * Uniform locations for CRT effect shader parameters.
 */
interface CrtUniforms {
  scanlineIntensity: WebGLUniformLocation | null;
  scanlineSize: WebGLUniformLocation | null;
  vignetteStrength: WebGLUniformLocation | null;
  screenCurvature: WebGLUniformLocation | null;
  barrelDistortion: WebGLUniformLocation | null;
  resolution: WebGLUniformLocation | null;
  phosphorPattern: WebGLUniformLocation | null;
  phosphorIntensity: WebGLUniformLocation | null;
  videoTexture: WebGLUniformLocation | null;
}

/**
 * WebGL-based CRT effect renderer.
 *
 * Renders scanlines and vignette with proper anti-aliasing at device pixel ratio,
 * eliminating the Moiré banding that CSS gradients suffer from at non-100% zoom.
 *
 * This is a standalone class with no Angular dependencies. It manages the full
 * WebGL lifecycle including shader compilation, buffer setup, rendering, and cleanup.
 *
 * @example
 * ```typescript
 * if (CrtRenderer.isSupported()) {
 *   const renderer = new CrtRenderer();
 *   if (renderer.init(canvasElement)) {
 *     renderer.updateSettings(crtSettings);
 *     renderer.resize(width, height);
 *     renderer.render();
 *   }
 *   // Later: renderer.destroy();
 * }
 * ```
 */
export class CrtRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private positionLocation = -1;

  // Uniform locations
  private uniforms: CrtUniforms = {
    scanlineIntensity: null,
    scanlineSize: null,
    vignetteStrength: null,
    screenCurvature: null,
    barrelDistortion: null,
    resolution: null,
    phosphorPattern: null,
    phosphorIntensity: null,
    videoTexture: null,
  };

  // Video texture pipeline
  private videoTexture: WebGLTexture | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private imageElement: HTMLImageElement | null = null;
  private animationFrameId: number | null = null;

  // Content type tracking
  private contentType: 'none' | 'video' | 'image' = 'none';

  // Context loss handling
  private contextLost = false;
  private contextLostHandler: ((e: Event) => void) | null = null;
  private contextRestoredHandler: (() => void) | null = null;
  private pendingSettings: CrtSettings | null = null;

  /**
   * Check if WebGL is available in this browser.
   * Call this before attempting to create a CrtRenderer.
   */
  static isSupported(): boolean {
    // Handle SSR or non-browser environments
    if (typeof document === 'undefined') {
      return false;
    }

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl !== null;
    } catch {
      return false;
    }
  }

  /**
   * Initialize WebGL context and compile shaders.
   *
   * @param canvas The canvas element to render to
   * @returns true if initialization succeeded, false otherwise
   */
  init(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;

    // Get WebGL context for post-processing pipeline
    // alpha:false because we output full opaque frames (not overlay)
    const gl = canvas.getContext('webgl', {
      alpha: false,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      // Try experimental-webgl for older browsers
      const experimentalGl = canvas.getContext('experimental-webgl', {
        alpha: false,
        premultipliedAlpha: false,
        antialias: false,
        preserveDrawingBuffer: false,
      });

      if (!experimentalGl) {
        console.warn('CrtRenderer: WebGL not available');
        return false;
      }

      this.gl = experimentalGl as WebGLRenderingContext;
    } else {
      this.gl = gl;
    }

    // Enable OES_standard_derivatives extension for fwidth() in shader
    const ext = this.gl.getExtension('OES_standard_derivatives');
    if (!ext) {
      console.warn('CrtRenderer: OES_standard_derivatives not available, anti-aliasing disabled');
    }

    // Set up context loss handling
    this.setupContextLossHandling();

    // Compile shaders and create program
    if (!this.setupShaders()) {
      this.destroy();
      return false;
    }

    // Create vertex buffer for fullscreen quad
    this.setupBuffers();

    // Disable blending for post-processing (we output full opaque frames)
    this.gl.disable(this.gl.BLEND);

    return true;
  }

  /**
   * Update shader uniforms from CRT settings.
   *
   * @param settings The current CRT effect settings
   */
  updateSettings(settings: CrtSettings): void {
    // Store settings for context restoration
    this.pendingSettings = settings;

    if (!this.gl || !this.program || this.contextLost) {
      return;
    }

    this.gl.useProgram(this.program);

    // Update all uniforms
    if (this.uniforms.scanlineIntensity !== null) {
      this.gl.uniform1f(this.uniforms.scanlineIntensity, settings.scanlineIntensity);
    }

    if (this.uniforms.scanlineSize !== null) {
      // Pass lineSize directly - shader handles DPR via resolution uniform
      this.gl.uniform1f(this.uniforms.scanlineSize, settings.scanlineSize);
    }

    if (this.uniforms.vignetteStrength !== null) {
      this.gl.uniform1f(this.uniforms.vignetteStrength, settings.vignetteStrength);
    }

    if (this.uniforms.screenCurvature !== null) {
      this.gl.uniform1f(this.uniforms.screenCurvature, settings.screenCurvature);
    }

    if (this.uniforms.barrelDistortion !== null) {
      this.gl.uniform1f(this.uniforms.barrelDistortion, settings.barrelDistortion);
    }

    // Phosphor pattern uniforms
    if (this.uniforms.phosphorPattern !== null) {
      // Map pattern type string to shader integer
      const patternMap: Record<string, number> = {
        'none': 0,
        'aperture-grille': 1,
        'shadow-mask': 2,
        'dot-triad': 3,
      };
      const patternValue = patternMap[settings.phosphorPattern] ?? 0;
      this.gl.uniform1i(this.uniforms.phosphorPattern, patternValue);
    }

    if (this.uniforms.phosphorIntensity !== null) {
      this.gl.uniform1f(this.uniforms.phosphorIntensity, settings.phosphorIntensity);
    }
  }

  /**
   * Render a single frame.
   * Should be called after updateSettings() and resize().
   */
  render(): void {
    if (!this.gl || !this.program || this.contextLost) {
      return;
    }

    // Clear with opaque black (WebGL post-processing, not overlay)
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Use our shader program
    this.gl.useProgram(this.program);

    // Bind video texture to uniform sampler
    if (this.videoTexture && this.uniforms.videoTexture !== null) {
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.videoTexture);
      this.gl.uniform1i(this.uniforms.videoTexture, 0);
    }

    // Bind vertex buffer and set up attribute
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.enableVertexAttribArray(this.positionLocation);
    this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Draw fullscreen quad (4 vertices as triangle strip)
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Handle canvas resize. Call when container size changes.
   *
   * Resizes the canvas to match the container at device pixel ratio,
   * ensuring sharp rendering on high-DPI displays.
   *
   * @param width Container width in CSS pixels
   * @param height Container height in CSS pixels
   */
  resize(width: number, height: number): void {
    if (!this.canvas || !this.gl || this.contextLost) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;

    // Set actual canvas size (drawing buffer) at device pixel ratio
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);

    // Set display size (CSS pixels)
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Update viewport to match canvas size
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Update resolution uniform for shader calculations
    if (this.uniforms.resolution !== null && this.program) {
      this.gl.useProgram(this.program);
      this.gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Clean up all WebGL resources.
   * Call this when the renderer is no longer needed.
   */
  destroy(): void {
    // Stop render loop
    this.stopRenderLoop();

    // Remove context loss event listeners
    if (this.canvas) {
      if (this.contextLostHandler) {
        this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
        this.contextLostHandler = null;
      }
      if (this.contextRestoredHandler) {
        this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
        this.contextRestoredHandler = null;
      }
    }

    // Clean up WebGL resources
    if (this.gl) {
      // Disable blending
      this.gl.disable(this.gl.BLEND);

      // Delete video texture
      if (this.videoTexture) {
        this.gl.deleteTexture(this.videoTexture);
        this.videoTexture = null;
      }

      // Delete vertex buffer
      if (this.vertexBuffer) {
        this.gl.deleteBuffer(this.vertexBuffer);
        this.vertexBuffer = null;
      }

      // Delete program (shaders are automatically detached)
      if (this.program) {
        this.gl.deleteProgram(this.program);
        this.program = null;
      }
    }

    // Clear references
    this.gl = null;
    this.canvas = null;
    this.videoElement = null;
    this.imageElement = null;
    this.contentType = 'none';
    this.uniforms = {
      scanlineIntensity: null,
      scanlineSize: null,
      vignetteStrength: null,
      screenCurvature: null,
      barrelDistortion: null,
      resolution: null,
      phosphorPattern: null,
      phosphorIntensity: null,
      videoTexture: null,
    };
    this.pendingSettings = null;
    this.contextLost = false;
  }

  /**
   * Check if the WebGL context is currently lost.
   */
  isContextLost(): boolean {
    return this.contextLost;
  }

  /**
   * Set the video element to sample from for the post-processing pipeline.
   * Must be called before startRenderLoop().
   *
   * @param video The HTML video element to process
   */
  setVideoElement(video: HTMLVideoElement): void {
    this.videoElement = video;
    this.imageElement = null;
    this.contentType = 'video';
    if (this.gl && !this.videoTexture) {
      this.createVideoTexture();
    }
  }

  /**
   * Set the image element to sample from for the post-processing pipeline.
   * Unlike video, images only need to render once (or on image change).
   *
   * @param image The HTML image element to process
   */
  setImageElement(image: HTMLImageElement): void {
    this.imageElement = image;
    this.videoElement = null;
    this.contentType = 'image';
    if (this.gl && !this.videoTexture) {
      this.createVideoTexture();
    }
  }

  /**
   * Render a single frame with the current image texture.
   * Call this after setImageElement() when the image is loaded,
   * or when settings change.
   */
  renderImage(): void {
    console.log('[CRT RENDERER DEBUG] renderImage called', {
      hasGl: !!this.gl,
      hasImage: !!this.imageElement,
      contentType: this.contentType,
      complete: this.imageElement?.complete,
      naturalWidth: this.imageElement?.naturalWidth,
      src: this.imageElement?.src?.substring(0, 80)
    });
    
    if (!this.gl || !this.imageElement || this.contentType !== 'image') {
      return;
    }

    this.updateImageTexture();
    this.render();
  }

  /**
   * Get the current content type being rendered.
   */
  getContentType(): 'none' | 'video' | 'image' {
    return this.contentType;
  }

  /**
   * Start the continuous render loop synchronized with video playback.
   * The shader will sample the video element as a texture each frame.
   */
  startRenderLoop(): void {
    if (this.animationFrameId !== null) {
      return; // Already running
    }

    const loop = () => {
      if (this.contextLost) {
        this.animationFrameId = requestAnimationFrame(loop);
        return;
      }

      this.updateVideoTexture();
      this.render();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Stop the continuous render loop.
   */
  stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Set up WebGL context loss handling.
   * Mobile browsers may lose context when backgrounded.
   */
  private setupContextLossHandling(): void {
    if (!this.canvas) {
      return;
    }

    this.contextLostHandler = (e: Event) => {
      e.preventDefault(); // Allow context to be restored
      this.contextLost = true;
      console.warn('CrtRenderer: WebGL context lost');
    };

    this.contextRestoredHandler = () => {
      console.info('CrtRenderer: WebGL context restored, reinitializing');
      this.contextLost = false;

      // Reinitialize everything
      if (this.canvas) {
        // Re-setup shaders and buffers
        if (!this.setupShaders()) {
          console.error('CrtRenderer: Failed to reinitialize shaders after context restore');
          return;
        }
        this.setupBuffers();

        // Recreate video texture if needed
        if (this.videoElement && !this.videoTexture) {
          this.createVideoTexture();
        }

        // Disable blending (post-processing pipeline)
        if (this.gl) {
          this.gl.disable(this.gl.BLEND);
        }

        // Restore settings and resize
        if (this.pendingSettings) {
          this.updateSettings(this.pendingSettings);
        }

        // Re-apply current size
        const rect = this.canvas.getBoundingClientRect();
        this.resize(rect.width, rect.height);
      }
    };

    this.canvas.addEventListener('webglcontextlost', this.contextLostHandler);
    this.canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler);
  }

  /**
   * Compile shaders and create the shader program.
   */
  private setupShaders(): boolean {
    if (!this.gl) {
      return false;
    }

    // Compile vertex shader
    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, PASSTHROUGH_VERTEX_SHADER);
    if (!vertexShader) {
      return false;
    }

    // Compile fragment shader
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, SCANLINE_FRAGMENT_SHADER);
    if (!fragmentShader) {
      this.gl.deleteShader(vertexShader);
      return false;
    }

    // Create and link program
    const program = this.gl.createProgram();
    if (!program) {
      this.gl.deleteShader(vertexShader);
      this.gl.deleteShader(fragmentShader);
      return false;
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    // Check link status
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      console.error('CrtRenderer: Shader program link failed:', info);
      this.gl.deleteProgram(program);
      this.gl.deleteShader(vertexShader);
      this.gl.deleteShader(fragmentShader);
      return false;
    }

    // Clean up shaders (they're now attached to program)
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    this.program = program;

    // Get uniform locations
    this.uniforms.scanlineIntensity = this.gl.getUniformLocation(program, 'u_scanlineIntensity');
    this.uniforms.scanlineSize = this.gl.getUniformLocation(program, 'u_scanlineSize');
    this.uniforms.vignetteStrength = this.gl.getUniformLocation(program, 'u_vignetteStrength');
    this.uniforms.screenCurvature = this.gl.getUniformLocation(program, 'u_screenCurvature');
    this.uniforms.barrelDistortion = this.gl.getUniformLocation(program, 'u_barrelDistortion');
    this.uniforms.resolution = this.gl.getUniformLocation(program, 'u_resolution');
    this.uniforms.phosphorPattern = this.gl.getUniformLocation(program, 'u_phosphorPattern');
    this.uniforms.phosphorIntensity = this.gl.getUniformLocation(program, 'u_phosphorIntensity');
    this.uniforms.videoTexture = this.gl.getUniformLocation(program, 'u_videoTexture');

    // Get attribute location
    this.positionLocation = this.gl.getAttribLocation(program, 'a_position');

    return true;
  }

  /**
   * Compile a shader from source.
   */
  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) {
      return null;
    }

    const shader = this.gl.createShader(type);
    if (!shader) {
      return null;
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      const shaderType = type === this.gl.VERTEX_SHADER ? 'vertex' : 'fragment';
      console.error(`CrtRenderer: ${shaderType} shader compile failed:`, info);
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Create and populate the vertex buffer for fullscreen quad.
   */
  private setupBuffers(): void {
    if (!this.gl) {
      return;
    }

    // Fullscreen quad vertices (two triangles as triangle strip)
    // Covers clip space from (-1,-1) to (1,1)
    const vertices = new Float32Array([
      -1, -1, // bottom-left
      1, -1, // bottom-right
      -1, 1, // top-left
      1, 1, // top-right
    ]);

    this.vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
  }

  /**
   * Create the WebGL texture for video frame sampling.
   * Called when video element is set.
   */
  private createVideoTexture(): void {
    if (!this.gl) {
      return;
    }

    this.videoTexture = this.gl.createTexture();
    if (!this.videoTexture) {
      console.warn('CrtRenderer: Failed to create WebGL texture');
      return;
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.videoTexture);

    // Required settings for video textures (NPOT = Non-Power-Of-Two)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
  }

  /**
   * Update the video texture from the current video element frame.
   * Called each render frame to keep texture in sync with video playback.
   */
  private updateVideoTexture(): void {
    if (!this.gl || !this.videoTexture || !this.videoElement) {
      return;
    }

    // Don't update if video is not ready
    if (this.videoElement.readyState < this.videoElement.HAVE_CURRENT_DATA) {
      return;
    }

    try {
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.videoTexture);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        this.videoElement
      );
    } catch (error) {
      // This can happen with cross-origin videos or during context loss
      console.warn('CrtRenderer: Failed to update video texture:', error);
    }
  }

  /**
   * Update the texture from the current image element.
   * Called once when image loads and when image source changes.
   */
  private updateImageTexture(): void {
    if (!this.gl || !this.videoTexture || !this.imageElement) {
      console.log('[CRT RENDERER DEBUG] updateImageTexture early return - missing gl/texture/image');
      return;
    }

    // Don't update if image is not ready
    if (!this.imageElement.complete || this.imageElement.naturalWidth === 0) {
      console.log('[CRT RENDERER DEBUG] updateImageTexture - image not ready', {
        complete: this.imageElement.complete,
        naturalWidth: this.imageElement.naturalWidth
      });
      return;
    }

    console.log('[CRT RENDERER DEBUG] updateImageTexture - uploading texture');
    try {
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.videoTexture);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        this.imageElement
      );
    } catch (error) {
      // This can happen with cross-origin images
      console.warn('CrtRenderer: Failed to update image texture:', error);
    }
  }
}
