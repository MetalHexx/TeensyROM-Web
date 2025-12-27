import { CrtSettings } from '@teensyrom-nx/domain';
import { PASSTHROUGH_VERTEX_SHADER } from './shaders/passthrough.vert';
import { SCANLINE_FRAGMENT_SHADER } from './shaders/scanline.frag';
import { CropAnimator } from './crop-animator';
import { DetectionPassRenderer } from './detection/detection-pass-renderer';
import { VideoModeDetector, CropRect } from './detection/video-mode-detector';

/**
 * Uniform locations for CRT effect shader parameters.
 */
interface CrtUniforms {
  scanlineIntensity: WebGLUniformLocation | null;
  scanlineSize: WebGLUniformLocation | null;
  vignetteStrength: WebGLUniformLocation | null;
  screenCurvature: WebGLUniformLocation | null;
  bloomIntensity: WebGLUniformLocation | null;
  barrelDistortion: WebGLUniformLocation | null;
  chromaticAberration: WebGLUniformLocation | null;
  resolution: WebGLUniformLocation | null;
  phosphorPattern: WebGLUniformLocation | null;
  phosphorIntensity: WebGLUniformLocation | null;
  monochromePhosphor: WebGLUniformLocation | null;
  videoTexture: WebGLUniformLocation | null;
  cropRect: WebGLUniformLocation | null;
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

  constructor() {
    // Initialize animator and video mode detector (detection pipeline created in init after GL context)
    this.cropAnimator = new CropAnimator();
    this.videoModeDetector = new VideoModeDetector();
  }

  // Uniform locations
  private uniforms: CrtUniforms = {
    scanlineIntensity: null,
    scanlineSize: null,
    vignetteStrength: null,
    screenCurvature: null,
    bloomIntensity: null,
    barrelDistortion: null,
    chromaticAberration: null,
    resolution: null,
    phosphorPattern: null,
    phosphorIntensity: null,
    monochromePhosphor: null,
    videoTexture: null,
    cropRect: null,
  };

  // Video texture pipeline
  private videoTexture: WebGLTexture | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private imageElement: HTMLImageElement | null = null;
  private animationFrameId: number | null = null;

  // Content type tracking
  private contentType: 'none' | 'video' | 'image' = 'none';

  // GPU-based black bar detection (Phase 1.1) and animation
  private detectionPassRenderer: DetectionPassRenderer | null = null;
  private videoModeDetector: VideoModeDetector;
  private cropAnimator: CropAnimator;
  private lastDetectionTime = -1; // -1 = never detected, allows first detection immediately
  private detectionEnabled = false;
  private readonly DETECTION_THROTTLE_MS = 200; // 5 FPS detection rate

  // Debug visualization for crop detection (Phase 1.1 - Task 01.1-006)
  private debugVisualizationEnabled = false;
  private debugCanvas: HTMLCanvasElement | null = null;
  private debugCtx: CanvasRenderingContext2D | null = null;
  private lastEdgeMeasurements: { left: number; top: number; right: number; bottom: number } | null = null;
  private lastCropRect: CropRect | null = null;

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

    this.createDebugCanvas();

    const gl = canvas.getContext('webgl', {
      alpha: false,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
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

    const ext = this.gl.getExtension('OES_standard_derivatives');
    if (!ext) {
      console.warn('CrtRenderer: OES_standard_derivatives not available, anti-aliasing disabled');
    }

    this.setupContextLossHandling();

    if (!this.setupShaders()) {
      this.destroy();
      return false;
    }

    this.setupBuffers();

    try {
      this.detectionPassRenderer = new DetectionPassRenderer(this.gl);
    } catch (error) {
      console.error('CrtRenderer: Failed to initialize GPU detection pipeline:', error);
    }

    this.gl.disable(this.gl.BLEND);

    return true;
  }

  /**
   * Update shader uniforms from CRT settings.
   *
   * @param settings The current CRT effect settings
   */
  updateSettings(settings: CrtSettings): void {
    this.pendingSettings = settings;

    if (!this.gl || !this.program || this.contextLost) {
      return;
    }

    this.gl.useProgram(this.program);

    if (this.uniforms.scanlineIntensity !== null) {
      this.gl.uniform1f(this.uniforms.scanlineIntensity, settings.scanlineIntensity);
    }

    if (this.uniforms.scanlineSize !== null) {
      this.gl.uniform1f(this.uniforms.scanlineSize, settings.scanlineSize);
    }

    if (this.uniforms.vignetteStrength !== null) {
      this.gl.uniform1f(this.uniforms.vignetteStrength, settings.vignetteStrength);
    }

    if (this.uniforms.screenCurvature !== null) {
      this.gl.uniform1f(this.uniforms.screenCurvature, settings.screenCurvature);
    }

    if (this.uniforms.bloomIntensity !== null) {
      this.gl.uniform1f(this.uniforms.bloomIntensity, settings.bloomIntensity);
    }

    if (this.uniforms.barrelDistortion !== null) {
      this.gl.uniform1f(this.uniforms.barrelDistortion, settings.barrelDistortion);
    }

    if (this.uniforms.phosphorPattern !== null) {
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

    if (this.uniforms.monochromePhosphor !== null) {
      const monochromeMap: Record<string, number> = {
        'none': 0.0,
        'white': 1.0,
        'amber': 2.0,
        'green': 3.0,
      };
      const monochromeValue = monochromeMap[settings.monochromePhosphor] ?? 0.0;
      this.gl.uniform1f(this.uniforms.monochromePhosphor, monochromeValue);
    }

    if (this.uniforms.chromaticAberration !== null) {
      this.gl.uniform1f(this.uniforms.chromaticAberration, settings.chromaticAberration);
    }

    this.detectionEnabled = settings.autoCropBlackBars || this.debugVisualizationEnabled;
    if (!this.detectionEnabled) {
      this.cropAnimator.reset();
      this.videoModeDetector.reset();
      this.lastDetectionTime = -1;
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

    if (
      this.detectionEnabled &&
      this.videoTexture &&
      this.canvas &&
      this.detectionPassRenderer &&
      this.pendingSettings
    ) {
      const now = performance.now();
      if (this.lastDetectionTime < 0 || now - this.lastDetectionTime >= this.DETECTION_THROTTLE_MS) {
        this.lastDetectionTime = now;

        try {
          const videoWidth = this.videoElement?.videoWidth || this.imageElement?.naturalWidth || this.canvas.width;
          const videoHeight = this.videoElement?.videoHeight || this.imageElement?.naturalHeight || this.canvas.height;

          this.detectionPassRenderer.renderEdgeDetection(
            this.videoTexture,
            videoWidth,
            videoHeight
          );

          const edgeMeasurements = this.detectionPassRenderer.readEdgeMeasurements();

          if (edgeMeasurements) {
              this.lastEdgeMeasurements = edgeMeasurements;

              let cropRect = this.videoModeDetector.detectMode(
                edgeMeasurements,
                this.pendingSettings.videoStandard,
                this.pendingSettings.videoMode
              );

              const previousCrop = this.lastCropRect;

              if (!cropRect) {
                if (previousCrop) {
                  console.log(`[CrtRenderer] Keeping previous crop during stabilization`);
                  cropRect = previousCrop;
                } else {
                  cropRect = {
                    left: 0,
                    top: 0,
                    width: 1,
                    height: 1
                  };
                }
              }

              this.lastCropRect = cropRect;

              if (cropRect && this.cropAnimator) {
                const isValid =
                  cropRect.left >= 0 && cropRect.left <= 1 &&
                  cropRect.top >= 0 && cropRect.top <= 1 &&
                  cropRect.width > 0 && cropRect.width <= 1 &&
                  cropRect.height > 0 && cropRect.height <= 1 &&
                  (cropRect.left + cropRect.width) <= 1.001 &&
                  (cropRect.top + cropRect.height) <= 1.001;

                if (isValid) {
                  this.cropAnimator.setTarget(cropRect);
                } else {
                  console.warn('[Detection] Invalid crop rejected:', cropRect);
                }
              }
          }
        } catch (error) {
          console.warn('CrtRenderer: Detection pipeline error:', error);
        }

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    let currentCrop = this.cropAnimator.update();

    if (this.debugVisualizationEnabled) {
      currentCrop = { left: 0, top: 0, width: 1, height: 1 };
      this.drawDebugOverlay();
    }

    if (currentCrop.width <= 0 || currentCrop.height <= 0) {
      console.warn('[CrtRenderer] Invalid crop detected, resetting:', currentCrop);
      this.cropAnimator.reset();
      currentCrop.left = 0;
      currentCrop.top = 0;
      currentCrop.width = 1;
      currentCrop.height = 1;
    }

    this.gl.clearColor(0, 0, 0, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.gl.useProgram(this.program);

    if (this.videoTexture && this.uniforms.videoTexture !== null) {
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.videoTexture);
      this.gl.uniform1i(this.uniforms.videoTexture, 0);
    }

    if (this.uniforms.cropRect !== null) {
      this.gl.uniform4f(
        this.uniforms.cropRect,
        currentCrop.left,
        currentCrop.top,
        currentCrop.width,
        currentCrop.height
      );
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.enableVertexAttribArray(this.positionLocation);
    this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);

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

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    if (this.debugCanvas) {
      this.debugCanvas.width = this.canvas.width;
      this.debugCanvas.height = this.canvas.height;
    }

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

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
    this.stopRenderLoop();

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

    if (this.gl) {
      this.gl.disable(this.gl.BLEND);

      if (this.detectionPassRenderer) {
        this.detectionPassRenderer.destroy();
        this.detectionPassRenderer = null;
      }

      if (this.videoTexture) {
        this.gl.deleteTexture(this.videoTexture);
        this.videoTexture = null;
      }

      if (this.vertexBuffer) {
        this.gl.deleteBuffer(this.vertexBuffer);
        this.vertexBuffer = null;
      }

      if (this.program) {
        this.gl.deleteProgram(this.program);
        this.program = null;
      }
    }

    if (this.debugCanvas) {
      this.debugCanvas.remove();
      this.debugCanvas = null;
      this.debugCtx = null;
    }

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
      bloomIntensity: null,
      barrelDistortion: null,
      chromaticAberration: null,
      resolution: null,
      phosphorPattern: null,
      phosphorIntensity: null,
      monochromePhosphor: null,
      videoTexture: null,
      cropRect: null,
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
    this.uniforms.bloomIntensity = this.gl.getUniformLocation(program, 'u_bloomIntensity');
    this.uniforms.barrelDistortion = this.gl.getUniformLocation(program, 'u_barrelDistortion');
    this.uniforms.chromaticAberration = this.gl.getUniformLocation(program, 'u_chromaticAberration');
    this.uniforms.resolution = this.gl.getUniformLocation(program, 'u_resolution');
    this.uniforms.phosphorPattern = this.gl.getUniformLocation(program, 'u_phosphorPattern');
    this.uniforms.phosphorIntensity = this.gl.getUniformLocation(program, 'u_phosphorIntensity');
    this.uniforms.monochromePhosphor = this.gl.getUniformLocation(program, 'u_monochromePhosphor');
    this.uniforms.videoTexture = this.gl.getUniformLocation(program, 'u_videoTexture');
    this.uniforms.cropRect = this.gl.getUniformLocation(program, 'u_cropRect');

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
      return;
    }

    // Don't update if image is not ready
    if (!this.imageElement.complete || this.imageElement.naturalWidth === 0) {
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
        this.imageElement
      );
    } catch (error) {
      // This can happen with cross-origin images
      console.warn('CrtRenderer: Failed to update image texture:', error);
    }
  }

  /**
   * Create debug canvas overlay for visualizing black bar detection.
   * Canvas is positioned absolutely over the main WebGL canvas.
   * (Phase 1.1 - Task 01.1-006)
   */
  private createDebugCanvas(): void {
    if (!this.canvas) {
      return;
    }

    this.debugCanvas = document.createElement('canvas');
    this.debugCanvas.style.position = 'absolute';
    this.debugCanvas.style.top = '0';
    this.debugCanvas.style.left = '0';
    this.debugCanvas.style.pointerEvents = 'none'; // Don't block mouse events
    this.debugCanvas.style.zIndex = '1000'; // Above video

    // Match main canvas size
    this.debugCanvas.width = this.canvas.width;
    this.debugCanvas.height = this.canvas.height;

    // Insert after main canvas
    this.canvas.parentElement?.appendChild(this.debugCanvas);

    this.debugCtx = this.debugCanvas.getContext('2d');

    if (this.debugCtx) {
      // Set default styles for neon green CRT aesthetic
      this.debugCtx.strokeStyle = '#00ff00';
      this.debugCtx.fillStyle = '#00ff00';
      this.debugCtx.font = 'bold 24px monospace';
      this.debugCtx.lineWidth = 4;
    }
  }

  /**
   * Enable or disable debug visualization overlay.
   * (Phase 1.1 - Task 01.1-006)
   */
  setDebugVisualization(enabled: boolean): void {
    this.debugVisualizationEnabled = enabled;
    
    // Enable/disable detection based on debug mode or auto-crop setting
    if (this.pendingSettings) {
      this.detectionEnabled = this.pendingSettings.autoCropBlackBars || enabled;
      
      // Reset detection on state change to get fresh results
      if (enabled) {
        this.lastDetectionTime = -1; // Allow immediate detection
      }
    }
    
    // Clear canvas when disabled
    if (!enabled && this.debugCanvas && this.debugCtx) {
      this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
    }
    
    console.log(`[CrtRenderer] Debug visualization ${enabled ? 'enabled' : 'disabled'} (press 'D' to toggle)`);
  }

  /**
   * Get current debug visualization state.
   * (Phase 1.1 - Task 01.1-006)
   */
  getDebugVisualization(): boolean {
    return this.debugVisualizationEnabled;
  }

  /**
   * Draw debug overlay showing detected black bar boundaries and measurements.
   * Called every frame when debugVisualizationEnabled is true.
   * (Phase 1.1 - Task 01.1-006)
   */
  private drawDebugOverlay(): void {
    if (!this.debugCanvas || !this.debugCtx || !this.canvas) {
      return;
    }

    const ctx = this.debugCtx;
    let width = this.debugCanvas.width;
    let height = this.debugCanvas.height;

    // Ensure debug canvas matches main canvas size
    if (this.debugCanvas.width !== this.canvas.width || this.debugCanvas.height !== this.canvas.height) {
      this.debugCanvas.width = this.canvas.width;
      this.debugCanvas.height = this.canvas.height;
      // Update local variables after resize
      width = this.debugCanvas.width;
      height = this.debugCanvas.height;
    }

    // Clear previous frame
    ctx.clearRect(0, 0, width, height);

    // Draw the downsampled detection image as background
    if (this.videoElement || this.imageElement) {
      const source = this.videoElement || this.imageElement;
      if (!source) return;

      const sourceWidth = this.videoElement
        ? this.videoElement.videoWidth
        : this.imageElement?.naturalWidth || width;
      const sourceHeight = this.videoElement
        ? this.videoElement.videoHeight
        : this.imageElement?.naturalHeight || height;

      // Calculate 1/8 downsampled dimensions
      const detectionWidth = Math.floor(sourceWidth / 8);
      const detectionHeight = Math.floor(sourceHeight / 8);

      // Create temporary canvas to downsample
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = detectionWidth;
      tempCanvas.height = detectionHeight;
      const tempCtx = tempCanvas.getContext('2d');

      if (tempCtx) {
        // Draw downsampled image
        tempCtx.drawImage(source, 0, 0, detectionWidth, detectionHeight);

        // Scale it up to fill the debug canvas (pixelated/nearest neighbor)
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tempCanvas, 0, 0, width, height);

        // Add label showing detection resolution
        ctx.font = 'bold 16px monospace';
        ctx.shadowBlur = 5;
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(width - 220, height - 40, 210, 30);
        ctx.fillStyle = '#00ff00';
        ctx.shadowColor = '#00ff00';
        ctx.fillText(`Detection: ${detectionWidth}x${detectionHeight}`, width - 20, height - 18);
      }
    }

    // Use actual edge measurements from brute-force detection
    // Default to 0 if no measurements yet
    const leftMeasure = this.lastEdgeMeasurements?.left ?? 0;
    const topMeasure = this.lastEdgeMeasurements?.top ?? 0;
    const rightMeasure = this.lastEdgeMeasurements?.right ?? 0;
    const bottomMeasure = this.lastEdgeMeasurements?.bottom ?? 0;

    const leftBarWidth = Math.max(leftMeasure * width, 0);
    const topBarHeight = Math.max(topMeasure * height, 0);
    const rightBarX = width - Math.max(rightMeasure * width, 0);
    const bottomBarY = height - Math.max(bottomMeasure * height, 0);

    // Draw semi-transparent red overlay on detected black bar regions
    // Always draw if measurement > 0, or show thin 1px indicator if at edge
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; // Red tint with transparency

    // Draw boxes for detected black bars
    if (leftMeasure > 0) {
      ctx.fillRect(0, 0, leftBarWidth, height); // Left bar
    }
    if (topMeasure > 0) {
      ctx.fillRect(0, 0, width, topBarHeight); // Top bar
    }
    if (rightMeasure > 0) {
      ctx.fillRect(rightBarX, 0, width - rightBarX, height); // Right bar
    }
    if (bottomMeasure > 0) {
      ctx.fillRect(0, bottomBarY, width, height - bottomBarY); // Bottom bar
    }

    // Draw neon green borders at the detected content boundaries
    // ALWAYS draw these lines during debug mode so you can see detection even if 0
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 10;

    // Left border (always draw during debug)
    ctx.beginPath();
    ctx.moveTo(leftBarWidth, 0);
    ctx.lineTo(leftBarWidth, height);
    ctx.stroke();

    // Top border
    ctx.beginPath();
    ctx.moveTo(0, topBarHeight);
    ctx.lineTo(width, topBarHeight);
    ctx.stroke();

    // Right border
    ctx.beginPath();
    ctx.moveTo(rightBarX, 0);
    ctx.lineTo(rightBarX, height);
    ctx.stroke();

    // Bottom border
    ctx.beginPath();
    ctx.moveTo(0, bottomBarY);
    ctx.lineTo(width, bottomBarY);
    ctx.stroke();

    // Draw debug info stacked on left side
    let currentY = 10;

    // 1. Draw measurement text with label at top
    ctx.font = 'bold 24px monospace';
    ctx.shadowBlur = 5;
    ctx.textAlign = 'left';

    // Section label
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, currentY, 115, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('Detection', 20, currentY + 22);

    currentY += 40;

    // Measurements
    ctx.font = 'bold 24px monospace';
    const measurementText = `L:${(leftMeasure * 100).toFixed(0)}% T:${(topMeasure * 100).toFixed(0)}% R:${(rightMeasure * 100).toFixed(0)}% B:${(bottomMeasure * 100).toFixed(0)}%`;

    // Background for text readability
    const textMetrics = ctx.measureText(measurementText);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, currentY, textMetrics.width + 20, 45);

    // Draw text
    ctx.fillStyle = '#00ff00';
    ctx.fillText(measurementText, 20, currentY + 32);

    // Move to next position (45 height + 12 gap = 57)
    currentY += 57;

    // 2. Draw crop rect info with label below measurements (or "Stabilizing...")
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';

    // Section label
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, currentY, 60, 30);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Crop', 20, currentY + 22);

    currentY += 40;

    // Crop values with proper labels
    ctx.font = 'bold 20px monospace';
    if (this.lastCropRect) {
      // CropRect stores content region (left, top, width, height)
      // Convert to crop percentages for each edge
      const cropLeft = (this.lastCropRect.left ?? 0) * 100;
      const cropTop = (this.lastCropRect.top ?? 0) * 100;
      const cropRight = (1 - (this.lastCropRect.left ?? 0) - (this.lastCropRect.width ?? 0)) * 100;
      const cropBottom = (1 - (this.lastCropRect.top ?? 0) - (this.lastCropRect.height ?? 0)) * 100;

      const cropText = `L:${cropLeft.toFixed(0)}% T:${cropTop.toFixed(0)}% R:${cropRight.toFixed(0)}% B:${cropBottom.toFixed(0)}%`;
      const cropMetrics = ctx.measureText(cropText);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, currentY, cropMetrics.width + 20, 40);
      ctx.fillStyle = '#00ff00';
      ctx.fillText(cropText, 20, currentY + 28);

      // Move to next position (40 height + 12 gap = 52)
      currentY += 52;
    } else {
      // Show "Stabilizing..." if we have measurements but no stable crop yet
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, currentY, 205, 40);
      ctx.fillStyle = '#ffff00';
      ctx.fillText('Stabilizing...', 20, currentY + 28);

      // Move to next position (40 height + 12 gap = 52)
      currentY += 52;
    }

    // 3. Draw current mode with label at the bottom
    const currentMode = this.videoModeDetector.getCurrentMode();
    if (currentMode) {
      // Section label
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, currentY, 65, 30);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Mode', 20, currentY + 22);

      currentY += 40;

      // Mode value
      const modeText = `${currentMode}`;
      ctx.font = 'bold 20px monospace';
      const modeMetrics = ctx.measureText(modeText);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, currentY, modeMetrics.width + 20, 35);
      ctx.fillStyle = '#00ffff';  // Cyan for mode
      ctx.fillText(modeText, 20, currentY + 25);
    }
  }
}
