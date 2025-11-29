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
  computed,
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
 * **CDK Overlay Awareness**: This component automatically detects when CDK overlays
 * (dropdowns, menus, dialogs) are opened from within its content and keeps the
 * overlay layer visible while those overlays are open. This prevents the common
 * issue where opening a dropdown causes other overlays to disappear.
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

  /**
   * Tracks whether a CDK overlay (dropdown, menu, etc.) is currently open.
   * When true, overlays stay visible even if mouse leaves the container.
   */
  readonly hasCdkOverlayOpen = signal<boolean>(false);

  /**
   * Manual overlay lock counter. Increment to keep overlays visible,
   * decrement when done. Useful for programmatic overlay control.
   */
  readonly overlayLockCount = signal<number>(0);

  /**
   * Whether overlays should be visible based on all factors:
   * - Mouse is over container, OR
   * - A CDK overlay is open, OR
   * - Manual overlay lock is active
   */
  readonly shouldShowOverlays = computed(() => {
    return this.isMouseOver() || this.hasCdkOverlayOpen() || this.overlayLockCount() > 0;
  });

  private readonly fullscreenHandler = (): void => {
    const isFs = !!document.fullscreenElement;
    this.isFullscreen.set(isFs);
    this.fullscreenChange.emit(isFs);
  };

  /**
   * MutationObserver to watch for CDK overlay presence.
   * This detects when dropdowns/menus open and close.
   */
  private overlayObserver: MutationObserver | null = null;

  constructor() {
    afterNextRender(() => {
      document.addEventListener('fullscreenchange', this.fullscreenHandler);
      this.setupCdkOverlayObserver();
    });

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('fullscreenchange', this.fullscreenHandler);
      this.overlayObserver?.disconnect();
    });
  }

  /**
   * Sets up a MutationObserver to detect when CDK overlays are added/removed.
   * This allows us to keep overlays visible when dropdowns are open.
   */
  private setupCdkOverlayObserver(): void {
    const overlayContainer = document.querySelector('.cdk-overlay-container');
    if (!overlayContainer) {
      // CDK overlay container doesn't exist yet - try again shortly
      setTimeout(() => this.setupCdkOverlayObserver(), 100);
      return;
    }

    this.overlayObserver = new MutationObserver(() => {
      this.checkForOpenOverlays();
    });

    this.overlayObserver.observe(overlayContainer, {
      childList: true,
      subtree: true,
    });

    // Initial check
    this.checkForOpenOverlays();
  }

  /**
   * Checks if any CDK overlay panes are currently visible.
   */
  private checkForOpenOverlays(): void {
    const overlayPanes = document.querySelectorAll('.cdk-overlay-pane');
    const hasOpenOverlay = overlayPanes.length > 0;
    this.hasCdkOverlayOpen.set(hasOpenOverlay);
  }

  /**
   * Handle mouse entering the container - show overlays.
   */
  onMouseEnter(): void {
    this.isMouseOver.set(true);
  }

  /**
   * Handle mouse leaving the container - hide overlays (unless locked).
   */
  onMouseLeave(): void {
    this.isMouseOver.set(false);
  }

  /**
   * Lock overlays to stay visible. Call unlockOverlays() when done.
   * Multiple locks can be active simultaneously.
   */
  lockOverlays(): void {
    this.overlayLockCount.update((count) => count + 1);
  }

  /**
   * Unlock overlays. Only hides when all locks are released.
   */
  unlockOverlays(): void {
    this.overlayLockCount.update((count) => Math.max(0, count - 1));
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
