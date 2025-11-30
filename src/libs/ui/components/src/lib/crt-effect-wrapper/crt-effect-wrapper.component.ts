import { Component, ChangeDetectionStrategy, input, computed, signal, ElementRef, viewChild, afterNextRender, inject, DestroyRef } from '@angular/core';
import { CrtSettings } from './crt-settings.interface';
import { DEFAULT_CRT_SETTINGS } from './crt-settings.defaults';

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
  private readonly wrapperRef = viewChild<ElementRef<HTMLElement>>('wrapper');
  private resizeObserver: ResizeObserver | null = null;

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

  constructor() {
    afterNextRender(() => {
      this.setupResizeObserver();
    });

    this.destroyRef.onDestroy(() => {
      this.resizeObserver?.disconnect();
    });
  }

  /**
   * Set up ResizeObserver to track container dimensions for clip-path calculation.
   */
  private setupResizeObserver(): void {
    const wrapper = this.wrapperRef()?.nativeElement;
    if (!wrapper) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.containerWidth.set(entry.contentRect.width);
        this.containerHeight.set(entry.contentRect.height);
      }
    });

    this.resizeObserver.observe(wrapper);

    // Initial measurement
    this.containerWidth.set(wrapper.clientWidth);
    this.containerHeight.set(wrapper.clientHeight);
  }
}
