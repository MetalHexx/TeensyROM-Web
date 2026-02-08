import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScalingCompactCardComponent } from '../scaling-compact-card/scaling-compact-card.component';
import { NavRailItem } from './nav-rail.model';
import { NavRailItemComponent } from './nav-rail-item.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { TooltipConfig, TooltipPosition } from '../tooltip/tooltip.directive';

/**
 * A reusable navigation rail component that displays a vertical list of navigation items.
 * Wraps content in a scaling compact card for consistent styling and animations.
 *
 * The component is decoupled from routing - it emits events when items are clicked
 * and the parent component handles navigation logic.
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

  private readonly destroyRef = inject(DestroyRef);
  private expandTimer: ReturnType<typeof setTimeout> | null = null;
  private collapseTimer: ReturnType<typeof setTimeout> | null = null;

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

  /** Width of the rail when collapsed */
  collapsedWidth = input<string>('56px');

  /** Width of the rail when expanded */
  expandedWidth = input<string>('200px');

  /** Delay in milliseconds for hover transitions */
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

  private startExpandTimer(): void {
    this.expandTimer = setTimeout(() => {
      this.isExpanded.set(true);
      this.expandTimer = null;
    }, this.hoverDelayMs());
  }

  private startCollapseTimer(): void {
    this.collapseTimer = setTimeout(() => {
      this.isExpanded.set(false);
      this.collapseTimer = null;
    }, this.hoverDelayMs());
  }

  private clearExpandTimer(): void {
    if (this.expandTimer !== null) {
      clearTimeout(this.expandTimer);
      this.expandTimer = null;
    }
  }

  private clearCollapseTimer(): void {
    if (this.collapseTimer !== null) {
      clearTimeout(this.collapseTimer);
      this.collapseTimer = null;
    }
  }
}
