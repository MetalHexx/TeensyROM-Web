import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NavRailItem } from './nav-rail.model';

/**
 * Individual navigation item within a nav rail.
 * Displays an icon and label with support for collapsed/expanded states.
 *
 * This component is designed to be used within NavRailComponent's @for loop.
 * It receives expansion state from the parent and emits click events for navigation.
 *
 * @example
 * ```html
 * <lib-nav-rail-item
 *   [item]="navItem"
 *   [isExpanded]="isExpanded()"
 *   [isActive]="navItem.route === activeRoute()"
 *   (itemClick)="onNavigate($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-nav-rail-item',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './nav-rail-item.component.html',
  styleUrl: './nav-rail-item.component.scss',
})
export class NavRailItemComponent {
  // --- Inputs ---

  /** The navigation item data to display */
  item = input.required<NavRailItem>();

  /** Whether the nav rail is currently expanded (shows label) */
  isExpanded = input<boolean>(false);

  /** Whether this item represents the currently active route */
  isActive = input<boolean>(false);

  // --- Outputs ---

  /** Emitted when the item is clicked or activated via keyboard */
  itemClick = output<NavRailItem>();

  // --- Methods ---

  /**
   * Handles click and keyboard activation.
   * Emits the item for parent to handle navigation.
   */
  onClick(): void {
    this.itemClick.emit(this.item());
  }
}
