import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScalingCompactCardComponent } from '../scaling-compact-card/scaling-compact-card.component';
import { NavRailItem } from './nav-rail.model';
import { NavRailItemComponent } from './nav-rail-item.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { TooltipConfig, TooltipPosition } from '../tooltip/tooltip.directive';

/**
 * A reusable vertical navigation rail that displays a list of icon+label items, collapsed
 * to icons-only by default and expanding on hover (or when pinned) to show labels. Wraps
 * its content in a `ScalingCompactCardComponent` for consistent styling and entry
 * animation.
 *
 * The component is decoupled from routing - it emits events when items are clicked
 * and the parent component handles navigation logic.
 *
 * Reach for this component at tablet/desktop widths. At the phone breakpoint
 * (below 640px), hover expansion is disabled here — swap in `BottomBarComponent` instead,
 * which shares the same item shape (`NavRailItem`/`BottomBarItem`) but renders as a fixed
 * bottom strip more appropriate for touch navigation.
 *
 * @example
 * ```html
 * <lib-nav-rail
 *   [items]="navItems"
 *   [activeRoute]="currentRoute"
 *   (itemClick)="onNavigate($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-nav-rail',
  standalone: true,
  imports: [CommonModule, ScalingCompactCardComponent, NavRailItemComponent, IconButtonComponent],
  templateUrl: './nav-rail.component.html',
  styleUrl: './nav-rail.component.scss',
  host: {
    '(mouseenter)': 'onMouseEnter()',
    '(mouseleave)': 'onMouseLeave()',
    '[style.--nav-rail-collapsed-width]': 'collapsedWidth()',
    '[style.--nav-rail-expanded-width]': 'expandedWidth()',
  },
})
export class NavRailComponent {
  // --- Private State ---

  /** Used to register teardown logic that runs when the component is destroyed. */
  private readonly destroyRef = inject(DestroyRef);
  /** Pending hover-expand timer id, or `null` when no expand is scheduled. */
  private expandTimer: ReturnType<typeof setTimeout> | null = null;
  /** Pending hover-collapse timer id, or `null` when no collapse is scheduled. */
  private collapseTimer: ReturnType<typeof setTimeout> | null = null;

  /** Clears any pending expand/collapse timers when the component is destroyed. */
  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearExpandTimer();
      this.clearCollapseTimer();
    });
  }

  // --- Inputs ---

  /** Navigation items to display in the rail */
  items = input.required<NavRailItem[]>();

  /** Current active route for highlighting the active item */
  activeRoute = input<string>('');

  /** Width of the rail when collapsed to icons-only (default: `'56px'`). Any valid CSS width value. */
  collapsedWidth = input<string>('56px');

  /** Width of the rail when expanded to show labels (default: `'200px'`). Any valid CSS width value. */
  expandedWidth = input<string>('200px');

  /** Milliseconds of hover dwell time before the rail expands or collapses (default: `150`). Prevents flicker from a mouse passing through without stopping. */
  hoverDelayMs = input<number>(150);

  // --- Outputs ---

  /** Emitted when a navigation item is clicked */
  itemClick = output<NavRailItem>();

  /** Emitted when the pin button is clicked */
  pinClick = output<boolean>();

  // --- Internal State ---

  /** Current expansion state of the rail */
  isExpanded = signal<boolean>(false);

  /** Whether the mouse is currently hovering over the rail */
  isHovering = signal<boolean>(false);

  /** Whether the rail is pinned open */
  isPinned = signal<boolean>(false);

  /** Tooltip configuration for pin button */
  pinTooltip: TooltipConfig = {
    body: 'Pin navigation',
    position: TooltipPosition.Right,
  };

  // --- Methods ---

  /**
   * Handles click on a navigation item.
   * Emits the clicked item for parent to handle navigation.
   */
  onItemClick(item: NavRailItem): void {
    this.itemClick.emit(item);
  }

  /**
   * Checks if a navigation item is currently active.
   * Uses exact match comparison.
   */
  isActive(item: NavRailItem): boolean {
    return item.route === this.activeRoute();
  }

  /**
   * Generates a unique track identifier for @for loop.
   */
  trackByRoute(index: number, item: NavRailItem): string {
    return item.route;
  }

  // --- Hover Handlers ---

  /**
   * Handles mouse entering the rail.
   * Starts delayed expansion if not already expanded and not pinned.
   * Disabled at phone size (< 640px) where rail is always collapsed as bottom bar.
   */
  onMouseEnter(): void {
    // Disable hover expansion at phone size
    if (this.isPhoneSize()) {
      return;
    }

    this.isHovering.set(true);
    this.clearCollapseTimer();

    if (!this.isExpanded() && !this.isPinned()) {
      this.startExpandTimer();
    }
  }

  /**
   * Handles mouse leaving the rail.
   * Starts delayed collapse if currently expanded and not pinned.
   * Disabled at phone size (< 640px) where rail is always collapsed as bottom bar.
   */
  onMouseLeave(): void {
    // Disable hover collapse at phone size
    if (this.isPhoneSize()) {
      return;
    }

    this.isHovering.set(false);
    this.clearExpandTimer();

    if (this.isExpanded() && !this.isPinned()) {
      this.startCollapseTimer();
    }
  }

  /**
   * Checks if the current viewport is phone size (< 640px).
   * Used to disable hover expansion at mobile breakpoint.
   */
  private isPhoneSize(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(max-width: 639px)').matches;
  }

  // --- Timer Helpers ---

  /**
   * Handles pin button click.
   * Toggles pinned state and expands/collapses accordingly.
   */
  onPinClick(): void {
    const newPinnedState = !this.isPinned();
    this.isPinned.set(newPinnedState);
    
    if (newPinnedState) {
      // When pinning, expand immediately
      this.clearCollapseTimer();
      this.isExpanded.set(true);
      this.pinTooltip = {
        body: 'Unpin navigation',
        position: TooltipPosition.Right,
      };
    } else {
      // When unpinning, collapse if not hovering
      if (!this.isHovering()) {
        this.isExpanded.set(false);
      }
      this.pinTooltip = {
        body: 'Pin navigation',
        position: TooltipPosition.Right,
      };
    }
    
    this.pinClick.emit(newPinnedState);
  }

  /** Schedules `isExpanded` to flip to `true` after `hoverDelayMs()`. */
  private startExpandTimer(): void {
    this.expandTimer = setTimeout(() => {
      this.isExpanded.set(true);
      this.expandTimer = null;
    }, this.hoverDelayMs());
  }

  /** Schedules `isExpanded` to flip to `false` after `hoverDelayMs()`. */
  private startCollapseTimer(): void {
    this.collapseTimer = setTimeout(() => {
      this.isExpanded.set(false);
      this.collapseTimer = null;
    }, this.hoverDelayMs());
  }

  /** Cancels any pending expand timer. */
  private clearExpandTimer(): void {
    if (this.expandTimer !== null) {
      clearTimeout(this.expandTimer);
      this.expandTimer = null;
    }
  }

  /** Cancels any pending collapse timer. */
  private clearCollapseTimer(): void {
    if (this.collapseTimer !== null) {
      clearTimeout(this.collapseTimer);
      this.collapseTimer = null;
    }
  }
}
