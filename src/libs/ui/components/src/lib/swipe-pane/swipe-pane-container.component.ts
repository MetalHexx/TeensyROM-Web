import {
  Component,
  ChangeDetectionStrategy,
  contentChildren,
  viewChild,
  ElementRef,
  input,
  output,
  signal,
  afterNextRender,
  inject,
  DestroyRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { SwipePaneDirective } from './swipe-pane.directive';

const TOUCH_DEVICE_QUERY = '(hover: none)';

/**
 * A horizontally-scrolling, snap-to-pane container for swipeable content — think mobile
 * tab panels. Reads its panes from `contentChildren(SwipePaneDirective)`, so each pane is
 * declared as an `<ng-template libSwipePane>` rather than passed as an input; an empty
 * container has nothing to swipe between. On touch devices, panes are navigated by
 * scroll/swipe gesture directly; on non-touch (`(hover: none)` false) devices, hovering
 * the swipe area reveals prev/next arrow controls and pagination dots instead, since there
 * is no native swipe gesture to rely on.
 *
 * @example
 * ```html
 * <lib-swipe-pane-container [initialPane]="0" (activePaneChange)="onPaneChange($event)">
 *   <ng-template libSwipePane label="Overview">
 *     <div>Overview content</div>
 *   </ng-template>
 *   <ng-template libSwipePane label="Settings">
 *     <div>Settings content</div>
 *   </ng-template>
 * </lib-swipe-pane-container>
 * ```
 */
@Component({
  selector: 'lib-swipe-pane-container',
  standalone: true,
  imports: [NgTemplateOutlet, MatIconModule],
  templateUrl: './swipe-pane-container.component.html',
  styleUrl: './swipe-pane-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwipePaneContainerComponent {
  /** Used to detect `(hover: none)` (touch) devices for `isTouchDevice`. */
  private readonly breakpointObserver = inject(BreakpointObserver);
  /** Used to register teardown logic that runs when the component is destroyed. */
  private readonly destroyRef = inject(DestroyRef);

  /** Panes projected via `<ng-template libSwipePane>`, in document order. */
  readonly panes = contentChildren(SwipePaneDirective);

  /** Zero-based index of the pane scrolled into view on init (default: `0` — the first pane). */
  readonly initialPane = input<number>(0);

  /**
   * Emitted with the new zero-based pane index whenever the active pane changes, whether by
   * scroll/swipe or by `scrollToPane()`/nav-arrow activation.
   */
  readonly activePaneChange = output<number>();

  /** Whether the current device matches `(hover: none)` — i.e. supports touch swipe rather than hover-revealed nav controls. */
  protected readonly isTouchDevice = toSignal(
    this.breakpointObserver.observe(TOUCH_DEVICE_QUERY).pipe(map(r => r.matches)),
    { initialValue: false }
  );

  /** Zero-based index of the pane currently scrolled into view. */
  protected readonly activePane = signal(0);
  /** Reference to the scrollable swipe area element. */
  protected readonly swipeContainer = viewChild<ElementRef<HTMLElement>>('swipeContainer');
  /** Whether a swipe/scroll gesture is currently in progress (or was within the last 1200ms). */
  protected readonly isSwiping = signal(false);
  /** Whether the hover-revealed prev/next nav controls and pagination dots are currently visible. */
  protected readonly showNav = signal(false);

  /** Timer resetting `isSwiping` back to `false` after scroll activity settles; `null` when not running. */
  private swipeTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Timer that reveals nav controls after a hover dwell; `null` when not running. */
  private navShowTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Timer that hides nav controls after the pointer leaves the swipe area; `null` when not running. */
  private navHideTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Timer that auto-hides nav controls after a period of inactivity; `null` when not running. */
  private navAutoHideTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Whether the pointer is currently over a nav control, suppressing auto-hide. */
  private hoveringNavControl = false;

  /** Scrolls to `initialPane()` and starts scroll tracking after the first render; clears all pending timers on destroy. */
  constructor() {
    this.destroyRef.onDestroy(() => this.clearAllTimeouts());

    afterNextRender(() => {
      const container = this.swipeContainer()?.nativeElement;
      if (!container) return;

      const initial = this.initialPane();
      if (initial > 0) {
        container.scrollLeft = initial * container.clientWidth;
      }
      this.activePane.set(initial);
      this.setupSwipeTracking();
    });
  }

  /** Listens for scroll on the swipe container, updating `activePane`/emitting `activePaneChange` and tracking `isSwiping`. */
  private setupSwipeTracking(): void {
    const container = this.swipeContainer()?.nativeElement;
    if (!container) return;

    container.addEventListener(
      'scroll',
      () => {
        const scrollLeft = container.scrollLeft;
        const width = container.clientWidth;
        const newPane = Math.round(scrollLeft / width);
        if (this.activePane() !== newPane) {
          this.activePane.set(newPane);
          this.activePaneChange.emit(newPane);
        }

        this.isSwiping.set(true);
        if (this.swipeTimeout) clearTimeout(this.swipeTimeout);
        this.swipeTimeout = setTimeout(() => this.isSwiping.set(false), 1200);
      },
      { passive: true }
    );
  }

  /** Smoothly scrolls to the pane at `index`, updating `activePane` and emitting `activePaneChange` immediately. */
  scrollToPane(index: number): void {
    const container = this.swipeContainer()?.nativeElement;
    if (!container) return;

    this.activePane.set(index);
    this.activePaneChange.emit(index);

    container.style.scrollSnapType = 'none';

    container.scrollTo({
      left: index * container.clientWidth,
      behavior: 'smooth',
    });

    const restoreSnap = () => {
      container.style.scrollSnapType = '';
      container.removeEventListener('scrollend', restoreSnap);
      clearTimeout(fallback);
    };
    container.addEventListener('scrollend', restoreSnap, { once: true });
    const fallback = setTimeout(restoreSnap, 600);
  }

  /** Scrolls to the next pane, if `activePane` isn't already the last one. */
  scrollToNextPane(): void {
    const maxPane = this.panes().length - 1;
    if (this.activePane() < maxPane) {
      this.scrollToPane(this.activePane() + 1);
    }
  }

  /** Scrolls to the previous pane, if `activePane` isn't already the first one. */
  scrollToPreviousPane(): void {
    if (this.activePane() > 0) {
      this.scrollToPane(this.activePane() - 1);
    }
  }

  /** On non-touch devices, schedules nav controls to reveal after a hover dwell. */
  onSwipeAreaMouseEnter(): void {
    if (this.isTouchDevice()) return;
    if (this.navHideTimeout) {
      clearTimeout(this.navHideTimeout);
      this.navHideTimeout = null;
    }
    this.navShowTimeout = setTimeout(() => {
      this.showNav.set(true);
      this.startAutoHideTimer();
    }, 400);
  }

  /** On non-touch devices, schedules nav controls to hide after the pointer leaves, unless a nav control is being hovered. */
  onSwipeAreaMouseLeave(): void {
    if (this.isTouchDevice()) return;
    if (this.navShowTimeout) {
      clearTimeout(this.navShowTimeout);
      this.navShowTimeout = null;
    }
    if (this.navAutoHideTimeout) {
      clearTimeout(this.navAutoHideTimeout);
      this.navAutoHideTimeout = null;
    }
    this.navHideTimeout = setTimeout(() => {
      if (!this.hoveringNavControl) {
        this.showNav.set(false);
      }
    }, 300);
  }

  /** On non-touch devices, shows nav controls (if hidden) and resets the auto-hide timer on pointer movement. */
  onSwipeAreaMouseMove(): void {
    if (this.isTouchDevice()) return;
    if (!this.showNav()) {
      this.showNav.set(true);
    }
    this.startAutoHideTimer();
  }

  /** Marks a nav control as hovered, canceling any pending hide/auto-hide. */
  onNavControlEnter(): void {
    this.hoveringNavControl = true;
    if (this.navHideTimeout) {
      clearTimeout(this.navHideTimeout);
      this.navHideTimeout = null;
    }
    if (this.navAutoHideTimeout) {
      clearTimeout(this.navAutoHideTimeout);
      this.navAutoHideTimeout = null;
    }
  }

  /** Clears the hovered-nav-control flag and restarts the auto-hide timer. */
  onNavControlLeave(): void {
    this.hoveringNavControl = false;
    this.startAutoHideTimer();
  }

  /** Schedules `showNav` to flip to `false` after a period of inactivity, unless a nav control is currently hovered. */
  private startAutoHideTimer(): void {
    if (this.navAutoHideTimeout) {
      clearTimeout(this.navAutoHideTimeout);
    }
    if (this.hoveringNavControl) return;
    this.navAutoHideTimeout = setTimeout(() => {
      this.showNav.set(false);
    }, 2500);
  }

  /** Clears every pending swipe/nav timer so none keep firing after teardown. */
  private clearAllTimeouts(): void {
    if (this.swipeTimeout) clearTimeout(this.swipeTimeout);
    if (this.navShowTimeout) clearTimeout(this.navShowTimeout);
    if (this.navHideTimeout) clearTimeout(this.navHideTimeout);
    if (this.navAutoHideTimeout) clearTimeout(this.navAutoHideTimeout);
  }
}
