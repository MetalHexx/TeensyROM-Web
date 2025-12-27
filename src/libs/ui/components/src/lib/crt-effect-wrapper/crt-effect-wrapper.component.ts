import { Component, ChangeDetectionStrategy, input, computed, signal, ElementRef, viewChild, afterNextRender, inject, DestroyRef, effect, Injector } from '@angular/core';
import { CrtSettings } from './crt-settings.interface';
import { DEFAULT_CRT_SETTINGS } from './crt-settings.defaults';
import { CrtRenderer } from './webgl/crt-renderer';

/** Maximum number of retry attempts when image element is not found after render */
const MAX_IMAGE_REFRESH_RETRIES = 3;

/**
 * A pure presentation wrapper component that applies CRT (cathode ray tube) visual effects
 * to any projected content via CSS custom properties.
 *
 * This component encapsulates CRT effects (scanlines, vignette, screen curvature, color filters)
 * and provides a clean interface for applying retro aesthetics without any store dependencies.
 *
 * Use the `config` input to control which effect groups are applied. This allows you to
 * use a subset of effects (e.g., scanlines only, color filters only) while the settings
 * panel shows only the relevant controls.
 *
 * For fullscreen mode with non-native aspect ratio content (e.g., 4:3 video on 16:9 screen),
 * provide the `contentAspectRatio` input to properly constrain CRT effects to the visible
 * content area (avoiding curvature/vignette on black bars).
 *
 * @example
 * ```html
 * <!-- Full CRT effects on video -->
 * <lib-crt-effect-wrapper [settings]="CRT_PRESETS.full" [enabled]="showCrt">
 *   <lib-video-stream [stream]="mediaStream"></lib-video-stream>
 * </lib-crt-effect-wrapper>
 *
 * <!-- 4:3 video with proper fullscreen handling -->
 * <lib-crt-effect-wrapper
 *   [settings]="settings()"
 *   [contentAspectRatio]="4/3">
 *   <lib-video-stream [stream]="stream" [objectFit]="'contain'"></lib-video-stream>
 * </lib-crt-effect-wrapper>
 * ```
 */
@Component({
  selector: 'lib-crt-effect-wrapper',
  standalone: true,
  imports: [],
  templateUrl: './crt-effect-wrapper.component.html',
  styleUrl: './crt-effect-wrapper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrtEffectWrapperComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly wrapperRef = viewChild<ElementRef<HTMLElement>>('wrapper');
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('glCanvas');
  private resizeObserver: ResizeObserver | null = null;
  private renderer: CrtRenderer | null = null;
  private dprMediaQuery: MediaQueryList | null = null;
  private dprChangeHandler: (() => void) | null = null;
  private contentObserver: MutationObserver | null = null;

  /** Track if component is destroyed to prevent operations during cleanup */
  private isDestroyed = false;

  /** Track pending refresh attempt count for retry logic */
  private refreshRetryCount = 0;

  /**
   * Track if WebGL is available in this browser.
   * Initialized once on component creation.
   */
  private readonly webglSupported = signal<boolean>(CrtRenderer.isSupported());

  /**
   * Track detected content type for WebGL rendering.
   * WebGL post-processing works with video and image elements.
   * 'none' means no compatible content found (component still renders with overlays).
   */
  private readonly webglContentType = signal<'none' | 'video' | 'image'>('none');

  /**
   * Store reference to current image element for load event handling.
   */
  private currentImageElement: HTMLImageElement | null = null;
  private imageLoadHandler: (() => void) | null = null;
  
  /**
   * Debug mode input from parent component.
   * (Phase 1.1 - Task 01.1-006)
   */
  readonly debugMode = input<boolean>(false);

  /**
   * Debug visualization state for black bar detection overlay.
   * Internal signal for tracking current debug state.
   * (Phase 1.1 - Task 01.1-006)
   */
  readonly debugVisualizationEnabled = signal<boolean>(false);

  /**
   * CRT effect configuration values.
   * Use CRT_PRESETS for common configurations or provide custom values.
   */
  readonly settings = input<CrtSettings>(DEFAULT_CRT_SETTINGS);

  /**
   * Whether CRT effects are applied.
   * When false, content renders without any effects (smooth transition).
   */
  readonly enabled = input<boolean>(true);

  /**
   * Content aspect ratio (width/height) for proper effect positioning in fullscreen.
   * When provided and content uses object-fit: contain, CRT effects are constrained
   * to the visible content area via clip-path.
   * Example: 4/3 for 4:3 video, 16/9 for 16:9 video.
   */
  readonly contentAspectRatio = input<number | null>(null);

  /**
   * Container dimensions for calculating visible content area.
   */
  private readonly containerWidth = signal<number>(0);
  private readonly containerHeight = signal<number>(0);

  /**
   * Computed canvas layout for WebGL mode.
   * Sizes canvas to match visible content area when contentAspectRatio is provided.
   */
  protected readonly canvasLayout = computed(() => {
    const aspectRatio = this.contentAspectRatio();
    const containerW = this.containerWidth();
    const containerH = this.containerHeight();

    if (!aspectRatio || containerW === 0 || containerH === 0) {
      return { width: '100%', height: '100%', left: '0', top: '0' };
    }

    const containerAspectRatio = containerW / containerH;

    if (Math.abs(aspectRatio - containerAspectRatio) < 0.01) {
      return { width: '100%', height: '100%', left: '0', top: '0' };
    }

    let visibleWidth: number;
    let visibleHeight: number;
    let offsetLeft: number;
    let offsetTop: number;

    if (aspectRatio > containerAspectRatio) {
      visibleWidth = containerW;
      visibleHeight = containerW / aspectRatio;
      offsetLeft = 0;
      offsetTop = (containerH - visibleHeight) / 2;
    } else {
      visibleHeight = containerH;
      visibleWidth = containerH * aspectRatio;
      offsetTop = 0;
      offsetLeft = (containerW - visibleWidth) / 2;
    }

    return {
      width: `${visibleWidth}px`,
      height: `${visibleHeight}px`,
      left: `${offsetLeft}px`,
      top: `${offsetTop}px`,
    };
  });

  /**
   * Computed clip-path for constraining effects to visible content area.
   */
  protected readonly clipPath = computed(() => {
    const aspectRatio = this.contentAspectRatio();
    const containerW = this.containerWidth();
    const containerH = this.containerHeight();
    const curvature = this.effectiveSettings().screenCurvature;

    if (!aspectRatio || containerW === 0 || containerH === 0) {
      return null;
    }

    const containerAspectRatio = containerW / containerH;

    if (Math.abs(aspectRatio - containerAspectRatio) < 0.01) {
      return null;
    }

    let visibleWidth: number;
    let visibleHeight: number;
    let insetLeft: number;
    let insetTop: number;

    if (aspectRatio > containerAspectRatio) {
      visibleWidth = containerW;
      visibleHeight = containerW / aspectRatio;
      insetLeft = 0;
      insetTop = (containerH - visibleHeight) / 2;
    } else {
      visibleHeight = containerH;
      visibleWidth = containerH * aspectRatio;
      insetTop = 0;
      insetLeft = (containerW - visibleWidth) / 2;
    }

    const leftPct = (insetLeft / containerW) * 100;
    const rightPct = ((containerW - insetLeft - visibleWidth) / containerW) * 100;
    const topPct = (insetTop / containerH) * 100;
    const bottomPct = ((containerH - insetTop - visibleHeight) / containerH) * 100;

    return `inset(${topPct}% ${rightPct}% ${bottomPct}% ${leftPct}% round ${curvature}px)`;
  });

  /**
   * Computed CSS variable values - directly uses settings.
   * All effect control (enable/disable) is now handled by setting values to neutral.
   */
  protected readonly effectiveSettings = computed(() => this.settings());

  constructor() {
    afterNextRender(() => {
      this.setupResizeObserver();
      this.setupDprListener();
      this.initializeWebGL();
      this.setupKeyboardShortcuts();
    });

    effect(() => {
      const settings = this.settings();
      const contentType = this.webglContentType();
      const debugModeValue = this.debugMode();

      this.debugVisualizationEnabled.set(debugModeValue);
      if (this.renderer) {
        this.renderer.setDebugVisualization(debugModeValue);
      }

      if (this.renderer && contentType === 'none') {
        const wrapper = this.wrapperRef()?.nativeElement;
        if (wrapper) {
          this.detectAndBindContent(wrapper);
        }
      }

      if (this.renderer) {
        this.renderer.updateSettings(settings);

        if (contentType === 'video') {
          this.renderer.startRenderLoop();
        } else if (contentType === 'image') {
          this.renderer.renderImage();
        }
      }
    });

    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      this.resizeObserver?.disconnect();
      this.cleanupDprListener();
      this.cleanupImageHandlers();
      this.cleanupKeyboardShortcuts();
      this.contentObserver?.disconnect();
      this.renderer?.destroy();
    });
  }

  /**
   * Initialize WebGL renderer if supported.
   */
  private initializeWebGL(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.webglSupported()) return;

    this.renderer = new CrtRenderer();
    const success = this.renderer.init(canvas);

    if (!success) {
      this.webglSupported.set(false);
      this.renderer = null;
      return;
    }

    this.renderer.updateSettings(this.settings());
    this.handleResize();
    this.setupContentTexturePipeline();
  }

  /**
   * Set up texture pipeline for post-processing.
   */
  private setupContentTexturePipeline(): void {
    if (!this.renderer) return;

    const wrapper = this.wrapperRef()?.nativeElement;
    if (!wrapper) return;

    this.detectAndBindContent(wrapper);

    this.contentObserver = new MutationObserver(() => {
      if (!this.isDestroyed && this.renderer) {
        this.detectAndBindContent(wrapper);
      }
    });

    this.contentObserver.observe(wrapper, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Detect video or image elements and bind to them.
   */
  private detectAndBindContent(wrapper: HTMLElement): void {
    if (!this.renderer) return;

    const video = wrapper.querySelector('video') as HTMLVideoElement | null;

    if (video) {
      this.webglContentType.set('video');
      this.renderer.setVideoElement(video);

      if (video.readyState >= video.HAVE_METADATA) {
        this.renderer.startRenderLoop();
      } else {
        const handler = () => {
          this.renderer?.startRenderLoop();
          video.removeEventListener('loadedmetadata', handler);
        };
        video.addEventListener('loadedmetadata', handler, { once: true });
      }
      return;
    }

    const image = (wrapper.querySelector('img.carousel-image.current') ||
                   wrapper.querySelector('img')) as HTMLImageElement | null;

    if (image) {
      this.webglContentType.set('image');
      this.setupImagePipeline(image);
      return;
    }

    this.webglContentType.set('none');
  }

  /**
   * Public method to refresh the WebGL texture when image content changes.
   * Call this from parent components when cycling images or changing content.
   * 
   * @example
   * ```html
   * <lib-crt-effect-wrapper #crtWrapper>
   *   <lib-cycle-image (imageChange)="crtWrapper.refreshImage()" />
   * </lib-crt-effect-wrapper>
   * ```
   */
  refreshImage(): void {
    if (!this.renderer || this.webglContentType() !== 'image') {
      return;
    }

    this.refreshRetryCount = 0;
    setTimeout(() => this.doRefreshImage(), 0);
  }

  /**
   * Internal method that performs the actual image refresh with retry logic.
   */
  private doRefreshImage(): void {
    if (this.isDestroyed || !this.renderer) return;

    const wrapper = this.wrapperRef()?.nativeElement;
    if (!wrapper) {
      return;
    }

    const image = (wrapper.querySelector('img.carousel-image.current') ||
                   wrapper.querySelector('img')) as HTMLImageElement | null;

    if (!image) {
      this.refreshRetryCount++;
      if (this.refreshRetryCount <= MAX_IMAGE_REFRESH_RETRIES) {
        setTimeout(() => this.doRefreshImage(), 16);
      }
      return;
    }

    this.refreshRetryCount = 0;
    this.cleanupImageHandlers();
    
    this.currentImageElement = image;
    this.renderer.setImageElement(image);

    // Set up load handler for when image finishes loading
    this.imageLoadHandler = () => {
      this.renderer?.renderImage();
    };
    image.addEventListener('load', this.imageLoadHandler);

    if (image.complete && image.naturalWidth > 0) {
      this.renderer.renderImage();
    }
  }

  /**
   * Set up image-specific WebGL pipeline.
   */
  private setupImagePipeline(image: HTMLImageElement): void {
    if (!this.renderer) return;

    this.cleanupImageHandlers();

    this.currentImageElement = image;
    this.renderer.setImageElement(image);

    if (image.complete && image.naturalWidth > 0) {
      this.renderer.renderImage();
    } else {
      this.imageLoadHandler = () => {
        this.renderer?.renderImage();
      };
      image.addEventListener('load', this.imageLoadHandler);
    }
  }

  /**
   * Clean up image-related event handlers.
   */
  private cleanupImageHandlers(): void {
    if (this.currentImageElement && this.imageLoadHandler) {
      this.currentImageElement.removeEventListener('load', this.imageLoadHandler);
    }
    this.imageLoadHandler = null;
    this.currentImageElement = null;
  }

  /**
   * Handle resize - update both container dimensions and WebGL canvas.
   */
  private handleResize(): void {
    const wrapper = this.wrapperRef()?.nativeElement;
    if (!wrapper) return;

    const containerWidth = wrapper.clientWidth;
    const containerHeight = wrapper.clientHeight;

    this.containerWidth.set(containerWidth);
    this.containerHeight.set(containerHeight);

    if (this.renderer) {
      const layout = this.canvasLayout();
      const canvasWidth = layout.width === '100%' ? containerWidth : parseFloat(layout.width);
      const canvasHeight = layout.height === '100%' ? containerHeight : parseFloat(layout.height);

      this.renderer.updateSettings(this.settings());
      this.renderer.resize(canvasWidth, canvasHeight);

      const contentType = this.webglContentType();
      if (contentType === 'image') {
        this.renderer.renderImage();
      } else {
        this.renderer.render();
      }
    }
  }

  /**
   * Set up listener for device pixel ratio changes (browser zoom).
   */
  private setupDprListener(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    this.cleanupDprListener();

    const dpr = window.devicePixelRatio || 1;
    this.dprMediaQuery = window.matchMedia(`(resolution: ${dpr}dppx)`);

    this.dprChangeHandler = () => {
      this.setupDprListener();
      this.handleResize();
    };

    this.dprMediaQuery.addEventListener('change', this.dprChangeHandler);
  }

  /**
   * Clean up DPR change listener.
   */
  private cleanupDprListener(): void {
    if (this.dprMediaQuery && this.dprChangeHandler) {
      this.dprMediaQuery.removeEventListener('change', this.dprChangeHandler);
      this.dprMediaQuery = null;
      this.dprChangeHandler = null;
    }
  }

  /**
   * Set up ResizeObserver to track container dimensions.
   */
  private setupResizeObserver(): void {
    const wrapper = this.wrapperRef()?.nativeElement;
    if (!wrapper) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });

    this.resizeObserver.observe(wrapper);
    this.handleResize();
  }

  /**
   * Set up keyboard shortcuts for debug controls.
   * (Phase 1.1 - Task 01.1-006)
   */
  private keyboardHandler: ((event: KeyboardEvent) => void) | null = null;

  private setupKeyboardShortcuts(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.keyboardHandler = (event: KeyboardEvent) => {
      if (event.key === 'd' || event.key === 'D') {
        this.toggleDebugVisualization();
      }
    };

    window.addEventListener('keydown', this.keyboardHandler);
  }

  /**
   * Clean up keyboard shortcut listener.
   * (Phase 1.1 - Task 01.1-006)
   */
  private cleanupKeyboardShortcuts(): void {
    if (this.keyboardHandler) {
      window.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }
  }

  /**
   * Toggle debug visualization for black bar detection.
   * (Phase 1.1 - Task 01.1-006)
   */
  toggleDebugVisualization(): void {
    const newState = !this.debugVisualizationEnabled();
    this.debugVisualizationEnabled.set(newState);
    this.renderer?.setDebugVisualization(newState);

    console.log(`[CrtEffectWrapper] Debug visualization ${newState ? 'enabled' : 'disabled'} (press 'D' to toggle)`);
  }
}
