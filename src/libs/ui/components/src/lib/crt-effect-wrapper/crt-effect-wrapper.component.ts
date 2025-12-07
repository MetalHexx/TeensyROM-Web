import { Component, ChangeDetectionStrategy, input, computed, signal, ElementRef, viewChild, afterNextRender, inject, DestroyRef, effect, Injector } from '@angular/core';
import { CrtSettings, CrtRenderMode } from './crt-settings.interface';
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
   * 'none' triggers CSS fallback for other content types.
   */
  private readonly webglContentType = signal<'none' | 'video' | 'image'>('none');

  /**
   * Store reference to current image element for load event handling.
   */
  private currentImageElement: HTMLImageElement | null = null;
  private imageLoadHandler: (() => void) | null = null;

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
   * When contentAspectRatio is provided, canvas is sized to match visible content area
   * (respecting object-fit: contain behavior).
   */
  protected readonly canvasLayout = computed(() => {
    const aspectRatio = this.contentAspectRatio();
    const containerW = this.containerWidth();
    const containerH = this.containerHeight();

    // No aspect ratio constraint - fill container
    if (!aspectRatio || containerW === 0 || containerH === 0) {
      return { width: '100%', height: '100%', left: '0', top: '0' };
    }

    const containerAspectRatio = containerW / containerH;

    // Same aspect ratio - fill container
    if (Math.abs(aspectRatio - containerAspectRatio) < 0.01) {
      return { width: '100%', height: '100%', left: '0', top: '0' };
    }

    // Calculate visible content dimensions using object-fit: contain logic
    let visibleWidth: number;
    let visibleHeight: number;
    let offsetLeft: number;
    let offsetTop: number;

    if (aspectRatio > containerAspectRatio) {
      // Content is wider - letterboxed (black bars top/bottom)
      visibleWidth = containerW;
      visibleHeight = containerW / aspectRatio;
      offsetLeft = 0;
      offsetTop = (containerH - visibleHeight) / 2;
    } else {
      // Content is narrower - pillarboxed (black bars left/right)
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

    // No clipping needed if no aspect ratio specified or container not measured
    if (!aspectRatio || containerW === 0 || containerH === 0) {
      return null;
    }

    const containerAspectRatio = containerW / containerH;

    // If content fills container (same aspect ratio), no clipping needed
    if (Math.abs(aspectRatio - containerAspectRatio) < 0.01) {
      return null;
    }

    // Calculate visible content dimensions using object-fit: contain logic
    let visibleWidth: number;
    let visibleHeight: number;
    let insetLeft: number;
    let insetTop: number;

    if (aspectRatio > containerAspectRatio) {
      // Content is wider - letterboxed (black bars top/bottom)
      visibleWidth = containerW;
      visibleHeight = containerW / aspectRatio;
      insetLeft = 0;
      insetTop = (containerH - visibleHeight) / 2;
    } else {
      // Content is narrower - pillarboxed (black bars left/right)
      visibleHeight = containerH;
      visibleWidth = containerH * aspectRatio;
      insetTop = 0;
      insetLeft = (containerW - visibleWidth) / 2;
    }

    // Convert to percentages for clip-path
    const leftPct = (insetLeft / containerW) * 100;
    const rightPct = ((containerW - insetLeft - visibleWidth) / containerW) * 100;
    const topPct = (insetTop / containerH) * 100;
    const bottomPct = ((containerH - insetTop - visibleHeight) / containerH) * 100;

    // Return clip-path inset with curvature for rounded corners
    return `inset(${topPct}% ${rightPct}% ${bottomPct}% ${leftPct}% round ${curvature}px)`;
  });

  /**
   * Computed CSS variable values - directly uses settings.
   * All effect control (enable/disable) is now handled by setting values to neutral.
   */
  protected readonly effectiveSettings = computed(() => this.settings());

  /**
   * Determine which render mode is actually active.
   * Uses explicit 'webgl' or 'css' value from settings.
   * WebGL will fall back to CSS if not supported or no compatible content.
   */
  protected readonly activeRenderMode = computed<CrtRenderMode>(() => {
    const requested = this.settings().renderMode;
    const contentType = this.webglContentType();
    const supported = this.webglSupported();

    console.log('[CRT DEBUG] activeRenderMode - requested:', requested, 'contentType:', contentType, 'webglSupported:', supported);

    // CSS mode is always available
    if (requested === 'css') return 'css';

    // WebGL requires browser support AND compatible content (video or image)
    const hasWebGLContent = contentType === 'video' || contentType === 'image';
    const canUseWebGL = supported && hasWebGLContent;

    console.log('[CRT DEBUG] activeRenderMode - hasWebGLContent:', hasWebGLContent, 'canUseWebGL:', canUseWebGL);

    // If WebGL requested but not available, fall back to CSS
    const result = canUseWebGL ? 'webgl' : 'css';
    console.log('[CRT DEBUG] activeRenderMode - returning:', result);
    return result;
  });

  /**
   * CSS class for current render mode.
   * Applied to wrapper element for mode-specific styling.
   */
  protected readonly renderModeClass = computed(() => `mode-${this.activeRenderMode()}`);

  constructor() {
    afterNextRender(() => {
      this.setupResizeObserver();
      this.setupDprListener();
      this.initializeWebGL();
    });

    // Sync settings to WebGL renderer when they change
    effect(() => {
      const settings = this.settings();
      const requestedMode = settings.renderMode;
      const contentType = this.webglContentType();

      console.log('[CRT DEBUG] Effect triggered - requestedMode:', requestedMode, 'contentType:', contentType, 'renderer:', !!this.renderer);

      // Re-detect content when switching to WebGL mode
      if (requestedMode === 'webgl' && this.renderer && contentType === 'none') {
        console.log('[CRT DEBUG] Switching to WebGL mode, re-detecting content...');
        const wrapper = this.wrapperRef()?.nativeElement;
        if (wrapper) {
          this.detectAndBindContent(wrapper);
        }
      }

      const mode = this.activeRenderMode();
      console.log('[CRT DEBUG] Effect - activeRenderMode resolved to:', mode);

      if (mode === 'webgl' && this.renderer) {
        console.log('[CRT DEBUG] Updating WebGL renderer settings');
        this.renderer.updateSettings(settings);
        
        // Handle render loop based on content type
        if (contentType === 'video') {
          // Ensure video render loop is running when in WebGL mode
          console.log('[CRT DEBUG] Starting video render loop');
          this.renderer.startRenderLoop();
        } else if (contentType === 'image') {
          // For images, re-render on settings change (no continuous loop)
          console.log('[CRT DEBUG] Rendering image');
          this.renderer.renderImage();
        }
      } else if (mode === 'css' && this.renderer) {
        // Stop render loop when switching to CSS mode
        console.log('[CRT DEBUG] Stopping render loop (CSS mode)');
        this.renderer.stopRenderLoop();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      this.resizeObserver?.disconnect();
      this.cleanupDprListener();
      this.cleanupImageHandlers();
      this.contentObserver?.disconnect();
      this.renderer?.destroy();
    });
  }

  /**
   * Initialize WebGL renderer if supported.
   * Called once after first render when canvas is available.
   */
  private initializeWebGL(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.webglSupported()) return;

    this.renderer = new CrtRenderer();
    const success = this.renderer.init(canvas);

    if (!success) {
      // WebGL init failed - fall back to CSS mode
      this.webglSupported.set(false);
      this.renderer = null;
      return;
    }

    // Initial settings and render
    this.renderer.updateSettings(this.settings());
    this.handleResize();

    // Set up content texture pipeline (video or image)
    this.setupContentTexturePipeline();
  }

  /**
   * Set up texture pipeline for post-processing.
   * Detects video or image elements from projected content.
   * - Video: starts continuous render loop
   * - Image: renders once, call refreshImage() when content changes
   * - Other: falls back to CSS mode
   */
  private setupContentTexturePipeline(): void {
    if (!this.renderer) return;

    const wrapper = this.wrapperRef()?.nativeElement;
    if (!wrapper) return;

    // Detect and bind to current content
    this.detectAndBindContent(wrapper);

    // Set up MutationObserver to watch for content changes (video/image elements added)
    this.contentObserver = new MutationObserver(() => {
      if (!this.isDestroyed && this.renderer) {
        console.log('[CRT DEBUG] Content mutation detected, re-detecting content...');
        this.detectAndBindContent(wrapper);
      }
    });

    // Watch for child elements being added/removed (video/img elements)
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

    // Priority: video first, then image
    const video = wrapper.querySelector('video') as HTMLVideoElement | null;

    console.log('[CRT DEBUG] detectAndBindContent - video element:', video);
    console.log('[CRT DEBUG] detectAndBindContent - video readyState:', video?.readyState);

    if (video) {
      // Video found - use WebGL post-processing with render loop
      console.log('[CRT DEBUG] Setting webglContentType to "video"');
      this.webglContentType.set('video');
      this.renderer.setVideoElement(video);

      // Wait for video metadata to be available before starting render loop
      if (video.readyState >= video.HAVE_METADATA) {
        console.log('[CRT DEBUG] Video metadata available, starting render loop');
        this.renderer.startRenderLoop();
      } else {
        // Video not ready yet - wait for loadedmetadata
        console.log('[CRT DEBUG] Video metadata not ready, waiting for loadedmetadata event');
        const handler = () => {
          console.log('[CRT DEBUG] Video loadedmetadata event fired, starting render loop');
          this.renderer?.startRenderLoop();
          video.removeEventListener('loadedmetadata', handler);
        };
        video.addEventListener('loadedmetadata', handler, { once: true });
      }
      return;
    }

    // Try to find image element in projected content
    // Look for the "current" carousel image specifically, or any img
    const image = (wrapper.querySelector('img.carousel-image.current') ||
                   wrapper.querySelector('img')) as HTMLImageElement | null;

    if (image) {
      // Image found - use WebGL post-processing (render once)
      this.webglContentType.set('image');
      this.setupImagePipeline(image);
      return;
    }

    // No compatible content found - fall back to CSS mode
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
    console.log('[CRT DEBUG] refreshImage called', {
      hasRenderer: !!this.renderer,
      contentType: this.webglContentType(),
      isDestroyed: this.isDestroyed
    });
    
    if (!this.renderer || this.webglContentType() !== 'image') {
      console.log('[CRT DEBUG] refreshImage early return - no renderer or not image mode');
      return;
    }

    // Reset retry count for new refresh cycle
    this.refreshRetryCount = 0;

    // Use setTimeout to defer to next event loop tick, allowing Angular to update the DOM.
    // afterNextRender may not fire if no render is pending.
    console.log('[CRT DEBUG] scheduling deferred refresh');
    setTimeout(() => this.doRefreshImage(), 0);
  }

  /**
   * Internal method that performs the actual image refresh with retry logic.
   * Retries up to MAX_IMAGE_REFRESH_RETRIES times if the image element is not found,
   * as Angular's DOM updates may take multiple render cycles.
   */
  private doRefreshImage(): void {
    console.log('[CRT DEBUG] doRefreshImage called', {
      isDestroyed: this.isDestroyed,
      hasRenderer: !!this.renderer,
      retryCount: this.refreshRetryCount
    });
    
    // Guard against operations after component destruction
    if (this.isDestroyed || !this.renderer) return;

    const wrapper = this.wrapperRef()?.nativeElement;
    if (!wrapper) {
      console.log('[CRT DEBUG] no wrapper element');
      return;
    }

    // Find the current image (may have changed)
    const image = (wrapper.querySelector('img.carousel-image.current') ||
                   wrapper.querySelector('img')) as HTMLImageElement | null;

    console.log('[CRT DEBUG] image query result', {
      found: !!image,
      src: image?.src?.substring(0, 80),
      complete: image?.complete,
      naturalWidth: image?.naturalWidth
    });

    if (!image) {
      // Image not found - retry if we haven't exceeded max attempts
      this.refreshRetryCount++;
      console.log('[CRT DEBUG] no image found, retry count:', this.refreshRetryCount);
      if (this.refreshRetryCount <= MAX_IMAGE_REFRESH_RETRIES) {
        // Schedule another attempt after a brief delay
        setTimeout(() => this.doRefreshImage(), 16);
      }
      return;
    }

    // Reset retry count on success
    this.refreshRetryCount = 0;

    // Clean up any previous load handler
    this.cleanupImageHandlers();
    
    this.currentImageElement = image;
    console.log('[CRT DEBUG] calling setImageElement');
    this.renderer.setImageElement(image);

    // Set up load handler for when image finishes loading
    this.imageLoadHandler = () => {
      console.log('[CRT DEBUG] image load event fired, rendering');
      this.renderer?.renderImage();
    };
    image.addEventListener('load', this.imageLoadHandler);

    // Check if image is already loaded
    // Note: When src changes, complete becomes false until new image loads
    if (image.complete && image.naturalWidth > 0) {
      console.log('[CRT DEBUG] image already complete, rendering immediately');
      this.renderer.renderImage();
    } else {
      console.log('[CRT DEBUG] image not complete yet, waiting for load event');
    }
  }

  /**
   * Set up image-specific WebGL pipeline.
   * Handles initial render. Src changes are handled by contentObserver.
   */
  private setupImagePipeline(image: HTMLImageElement): void {
    if (!this.renderer) return;

    // Clean up any previous image handlers
    this.cleanupImageHandlers();

    this.currentImageElement = image;
    this.renderer.setImageElement(image);

    // Render when image is loaded
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

    // Update WebGL canvas size and re-render
    // Also re-apply settings since DPR may have changed (browser zoom)
    if (this.renderer && this.activeRenderMode() === 'webgl') {
      // Calculate actual canvas dimensions based on contentAspectRatio
      const layout = this.canvasLayout();
      const canvasWidth = layout.width === '100%' ? containerWidth : parseFloat(layout.width);
      const canvasHeight = layout.height === '100%' ? containerHeight : parseFloat(layout.height);

      this.renderer.updateSettings(this.settings());
      this.renderer.resize(canvasWidth, canvasHeight);

      // For images, explicitly re-render (video uses continuous loop)
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
   * ResizeObserver doesn't fire when zoom changes but element size stays the same.
   */
  private setupDprListener(): void {
    // Skip in test environments where matchMedia isn't available
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    // Clean up any existing listener
    this.cleanupDprListener();

    // Create a media query that matches the current DPR
    // When DPR changes (zoom), the match state changes and we get notified
    const dpr = window.devicePixelRatio || 1;
    this.dprMediaQuery = window.matchMedia(`(resolution: ${dpr}dppx)`);

    this.dprChangeHandler = () => {
      // DPR changed - need to set up new listener for new DPR value
      // and re-render with updated settings
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
   * Set up ResizeObserver to track container dimensions for clip-path calculation
   * and WebGL canvas sizing.
   */
  private setupResizeObserver(): void {
    const wrapper = this.wrapperRef()?.nativeElement;
    if (!wrapper) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });

    this.resizeObserver.observe(wrapper);

    // Initial measurement
    this.handleResize();
  }
}
