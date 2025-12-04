import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScalingCompactCardComponent } from '../scaling-compact-card/scaling-compact-card.component';
import { NavRailItem } from './nav-rail.model';
import { NavRailItemComponent } from './nav-rail-item.component';

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
  imports: [CommonModule, ScalingCompactCardComponent, NavRailItemComponent],
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

  // --- Internal State ---

  /** Current expansion state of the rail */
  isExpanded = signal<boolean>(false);

  /** Whether the mouse is currently hovering over the rail */
  isHovering = signal<boolean>(false);

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
   * Starts delayed expansion if not already expanded.
   */
  onMouseEnter(): void {
    this.isHovering.set(true);
    this.clearCollapseTimer();

    if (!this.isExpanded()) {
      this.startExpandTimer();
    }
  }

  /**
   * Handles mouse leaving the rail.
   * Starts delayed collapse if currently expanded.
   */
  onMouseLeave(): void {
    this.isHovering.set(false);
    this.clearExpandTimer();

    if (this.isExpanded()) {
      this.startCollapseTimer();
    }
  }

  // --- Timer Helpers ---

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
