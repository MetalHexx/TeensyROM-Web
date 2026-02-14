import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BottomBarItem } from './bottom-bar.model';

/**
 * A mobile-only bottom navigation bar for phone breakpoints.
 *
 * Designed as a flat, square, frosted-glass bar fixed to the bottom of the viewport.
 * No card wrapper or rounded corners — just a clean, glassy strip.
 *
 * Swap this in place of NavRailComponent at the phone breakpoint so the
 * vertical rail remains untouched at tablet/desktop sizes.
 *
 * @example
 * ```html
 * <lib-bottom-bar
 *   [items]="navItems"
 *   [activeRoute]="currentRoute"
 *   (itemClick)="onNavigate($event)"
 * />
 * ```
 */
@Component({
  selector: 'lib-bottom-bar',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './bottom-bar.component.html',
  styleUrl: './bottom-bar.component.scss',
})
export class BottomBarComponent {
  /** Navigation items to display in the bottom bar */
  items = input.required<BottomBarItem[]>();

  /** Current active route for highlighting the active item */
  activeRoute = input<string>('');

  /** Emitted when a navigation item is clicked */
  itemClick = output<BottomBarItem>();

  /** Checks if a navigation item is currently active */
  isActive(item: BottomBarItem): boolean {
    return item.route === this.activeRoute();
  }

  /** Handles item click and emits event */
  onItemClick(item: BottomBarItem): void {
    this.itemClick.emit(item);
  }
}
