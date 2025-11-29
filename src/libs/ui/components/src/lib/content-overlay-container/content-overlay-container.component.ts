import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
  DestroyRef,
  inject,
  afterNextRender,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * A pure presentation layout container component that manages overlay positioning,
 * hover-to-reveal behavior, and optional fullscreen support via named content projection slots.
 *
 * This component provides 9 named slots for flexible content composition:
 * - `content`: Background layer for primary content (video, image, or any element)
 * - `topLeftCorner`: Top-left corner (logo, branding)
 * - `topOverlay`: Top-center (filter toolbar)
 * - `topRightCorner`: Top-right corner (close button)
 * - `leftControls`: Left side middle (settings panel)
 * - `rightControls`: Right side middle (action buttons)
 * - `bottomLeftControls`: Bottom-left (player controls)
 * - `bottomOverlay`: Bottom-center (info, now playing)
 * - `bottomRightControls`: Bottom-right (extra controls)
 *
 * @example
 * ```html
 * <lib-content-overlay-container [showOverlaysOnHover]="true" (fullscreenChange)="onFullscreen($event)">
 *   <lib-video-stream content [stream]="mediaStream"></lib-video-stream>
 *   <lib-filter-toolbar topOverlay></lib-filter-toolbar>
 *   <lib-icon-button topRightCorner icon="close" (buttonClick)="close()"></lib-icon-button>
 *   <lib-crt-settings leftControls [settings]="crtSettings"></lib-crt-settings>
 *   <lib-player-controls bottomLeftControls></lib-player-controls>
 *   <lib-now-playing bottomOverlay [song]="currentSong"></lib-now-playing>
 * </lib-content-overlay-container>
 * ```
 */
@Component({
  selector: 'lib-content-overlay-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './content-overlay-container.component.html',
  styleUrl: './content-overlay-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentOverlayContainerComponent {
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Enable hover-to-reveal behavior for all overlay slots.
   * When true, overlays are hidden by default and revealed on container hover.
   */
  readonly showOverlaysOnHover = input<boolean>(true);

  /**
   * Transition duration in milliseconds for overlay show/hide animations.
   */
  readonly overlayTransitionMs = input<number>(300);

  /**
   * Emits when fullscreen state changes.
   * True when entering fullscreen, false when exiting.
   */
  readonly fullscreenChange = output<boolean>();

  /**
   * Reference to the container element for fullscreen API.
   */
  readonly containerRef = viewChild<ElementRef<HTMLElement>>('container');

  /**
   * Current fullscreen state.
   */
  readonly isFullscreen = signal<boolean>(false);

  /**
   * Tracks whether mouse is currently over the container.
   */
  readonly isMouseOver = signal<boolean>(false);

  private readonly fullscreenHandler = (): void => {
    const isFs = !!document.fullscreenElement;
    this.isFullscreen.set(isFs);
    this.fullscreenChange.emit(isFs);
  };

  constructor() {
    afterNextRender(() => {
      document.addEventListener('fullscreenchange', this.fullscreenHandler);
    });

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('fullscreenchange', this.fullscreenHandler);
    });
  }

  /**
   * Handle mouse entering the container - show overlays.
   */
  onMouseEnter(): void {
    this.isMouseOver.set(true);
  }

  /**
   * Handle mouse leaving the container - hide overlays.
   */
  onMouseLeave(): void {
    this.isMouseOver.set(false);
  }

  /**
   * Request fullscreen mode on the container element.
   */
  enterFullscreen(): void {
    this.containerRef()?.nativeElement?.requestFullscreen?.();
  }

  /**
   * Exit fullscreen mode.
   */
  exitFullscreen(): void {
    document.exitFullscreen?.();
  }

  /**
   * Toggle between fullscreen and normal mode.
   */
  toggleFullscreen(): void {
    if (this.isFullscreen()) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }
}
