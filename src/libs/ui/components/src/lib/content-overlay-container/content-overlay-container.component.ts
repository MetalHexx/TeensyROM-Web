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
 * **CDK Overlay Awareness**: This component uses scoped detection to identify when CDK overlays
 * (dropdowns, menus) are opened from within its content. The overlay layer stays visible while
 * those overlays are open, preventing them from disappearing unexpectedly. The detection is
 * scoped to only track overlays triggered from within this container, so it works correctly
 * whether the component is used standalone or inside a Material Dialog.
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
   * Inactivity timeout in milliseconds before hiding overlays.
   * Set to 0 to disable inactivity timer (overlays stay visible on hover).
   * Typical video player behavior: 3000ms (3 seconds).
   * @default 3000
   */
  readonly inactivityTimeoutMs = input<number>(3000);

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
   * Tracks whether a CDK overlay (dropdown, menu, etc.) owned by this container is currently open.
   * Uses scoped detection to only track overlays triggered from within this container.
   * When true, overlays stay visible even if mouse leaves the container.
   */
  readonly hasCdkOverlayOpen = signal<boolean>(false);

  /**
   * Manual overlay lock counter. Increment to keep overlays visible,
   * decrement when done. Useful for programmatic overlay control.
   */
  readonly overlayLockCount = signal<number>(0);

  /**
   * Tracks if a mouse leave event occurred while a tooltip was active.
   * Used to properly hide overlays once the tooltip closes.
   */
  private pendingMouseLeave = false;

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

  /**
   * Reference to the container DOM element for scoped overlay detection.
   * Used to determine if CDK overlays originated from within this container.
   */
  private containerElement: HTMLElement | null = null;

  /**
   * Timer ID for inactivity timeout.
   * Cleared on mouse movement, set when mouse stops moving.
   */
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => {
      // Initialize container element reference for scoped overlay detection
      this.containerElement = this.containerRef()?.nativeElement ?? null;
      document.addEventListener('fullscreenchange', this.fullscreenHandler);
      this.setupCdkOverlayObserver();
    });

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('fullscreenchange', this.fullscreenHandler);
      this.overlayObserver?.disconnect();
      this.clearInactivityTimer();
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
   * Checks if any CDK overlay panes owned by this container are currently visible.
   * Uses scoped detection to only count overlays triggered from within this container,
   * preventing false positives from parent dialogs or other components' overlays.
   * 
   * Note: Only transient overlays (tooltips, dropdowns) are counted. Persistent overlays
   * like CRT settings panel are not included because they should not prevent auto-hide behavior.
   */
  private checkForOpenOverlays(): void {
    if (!this.containerElement) {
      this.hasCdkOverlayOpen.set(false);
      return;
    }

    const overlayPanes = document.querySelectorAll('.cdk-overlay-pane');
    const ownedOverlays = Array.from(overlayPanes).filter((pane) =>
      this.isOverlayOwnedByContainer(pane)
    );

    const hasOverlays = ownedOverlays.length > 0;
    this.hasCdkOverlayOpen.set(hasOverlays);

    // If overlays just closed and we had a pending mouse leave, apply it now
    if (!hasOverlays && this.pendingMouseLeave) {
      this.pendingMouseLeave = false;
      this.isMouseOver.set(false);
    }
  }

  /**
   * Determines if a CDK overlay pane is owned by (triggered from within) this container.
   * 
   * Uses spatial proximity detection to prevent cross-component contamination:
   * 1. Exclude parent overlays that contain our container (e.g., parent dialog)
   * 2. For tooltips, check if positioned near this container (tight tolerance)
   * 3. For dropdowns, check if positioned near this container (moderate tolerance)
   * 
   * Note: CRT panel overlays are intentionally NOT detected here. They're persistent
   * user-controlled panels that should not prevent auto-hide behavior, so we don't
   * count them as "open overlays" that keep the overlay layer visible.
   * 
   * This approach is necessary because:
   * - We can't reliably check trigger elements (they may be hidden when overlays appear)
   * - Multiple component instances may exist on same page (file-image, video-capture, etc.)
   * - Components outside containers (player toolbar) can trigger overlays
   * - Spatial proximity is the most reliable way to determine ownership
   *
   * @param overlayPane The CDK overlay pane element to check
   * @returns True if the overlay is a transient overlay owned by this container
   */
  private isOverlayOwnedByContainer(overlayPane: Element): boolean {
    if (!this.containerElement) return false;

    // Strategy 0: Exclude parent overlays that contain our container
    // This handles the case where we're inside a dialog
    if (overlayPane.contains(this.containerElement)) {
      return false;
    }

    const containerRect = this.containerElement.getBoundingClientRect();
    const overlayRect = overlayPane.getBoundingClientRect();

    // Strategy 1: Tooltips - check if tooltip is within or very close to container bounds
    // Tooltips appear near their trigger elements, which are inside the container
    const isTooltip = overlayPane.classList.contains('mat-mdc-tooltip-panel');
    if (isTooltip) {
      // Check if tooltip is within expanded container bounds (100px padding for positioning)
      const tolerance = 100;
      const isNearContainer = 
        overlayRect.left < containerRect.right + tolerance &&
        overlayRect.right > containerRect.left - tolerance &&
        overlayRect.top < containerRect.bottom + tolerance &&
        overlayRect.bottom > containerRect.top - tolerance;
      return isNearContainer;
    }

    // Strategy 2: Dropdowns - check if dropdown is within or very close to container bounds
    // Dropdowns can be positioned further from trigger but still within general area
    const isDropdown = overlayPane.querySelector('.dropdown-menu-wrapper') !== null;
    if (isDropdown) {
      // Check if dropdown is within expanded container bounds (150px padding for positioning)
      const tolerance = 150;
      const isNearContainer = 
        overlayRect.left < containerRect.right + tolerance &&
        overlayRect.right > containerRect.left - tolerance &&
        overlayRect.top < containerRect.bottom + tolerance &&
        overlayRect.bottom > containerRect.top - tolerance;
      return isNearContainer;
    }

    // Note: CRT panel overlays are intentionally not handled here.
    // They should not contribute to hasCdkOverlayOpen signal.

    // If it's not a recognized transient overlay type, it's not ours
    return false;
  }

  /**
   * Handle mouse entering the container - show overlays and start inactivity timer.
   */
  onMouseEnter(): void {
    this.isMouseOver.set(true);
    this.pendingMouseLeave = false; // Clear any pending leave state
    this.resetInactivityTimer();
  }

  /**
   * Handle mouse movement within the container - reset inactivity timer.
   */
  onMouseMove(): void {
    this.onMouseActivity();
  }

  /**
   * Handle any mouse activity (move, click, scroll) - keeps overlays visible.
   */
  onMouseActivity(): void {
    // Show overlays if they were hidden by inactivity timer
    if (!this.isMouseOver()) {
      this.isMouseOver.set(true);
    }
    // Reset timer to restart countdown
    this.resetInactivityTimer();
  }

  /**
   * Handle mouse leaving the container - hide overlays (unless locked).
   * Uses microtask delay to ensure MutationObserver has processed any tooltip
   * overlay changes before checking hasCdkOverlayOpen signal.
   */
  onMouseLeave(): void {
    // Defer the check to next event loop tick to ensure MutationObserver has run
    setTimeout(() => {
      // Don't hide overlays if user moved to a tooltip/dropdown owned by this container
      if (!this.hasCdkOverlayOpen()) {
        this.isMouseOver.set(false);
        this.pendingMouseLeave = false;
      } else {
        // Mark that we should hide when the overlay closes
        this.pendingMouseLeave = true;
      }
    }, 0);
    this.clearInactivityTimer();
  }

  /**
   * Resets the inactivity timer. Clears existing timer and starts a new one.
   * After the timeout period with no mouse movement, overlays will be hidden.
   */
  private resetInactivityTimer(): void {
    this.clearInactivityTimer();

    const timeout = this.inactivityTimeoutMs();
    if (timeout <= 0) {
      // Inactivity timer disabled
      return;
    }

    this.inactivityTimer = setTimeout(() => {
      // Only hide if no CDK overlays are open and no manual locks
      if (!this.hasCdkOverlayOpen() && this.overlayLockCount() === 0) {
        this.isMouseOver.set(false);
      }
    }, timeout);
  }

  /**
   * Clears the inactivity timer if one is active.
   */
  private clearInactivityTimer(): void {
    if (this.inactivityTimer !== null) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
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
