import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DropdownMenuComponent } from './dropdown-menu.component';

/**
 * A single row inside a `DropdownMenuComponent`'s `[dropdown-content]` slot. Renders as a
 * full-width button with an optional leading check icon (`selected`), and injects its
 * parent `DropdownMenuComponent` (if present, via `inject(..., { optional: true })`) so it
 * can auto-close the dropdown after a click.
 *
 * This is easily confused with `MenuItemComponent` (`lib-menu-item`): that component is
 * for standalone navigation/action lists driven by a `MenuItem` config object (icon,
 * label, route, or action callback) and has no relationship to `DropdownMenuComponent`.
 * `DropdownMenuItemComponent`, by contrast, only makes sense projected inside
 * `lib-dropdown-menu`'s `[dropdown-content]` slot, takes its label via content projection
 * rather than a config object, and knows how to close its parent dropdown.
 *
 * Supports composable actions via named content projection — content passed to the
 * `[actions]` slot (e.g. edit/delete icon buttons) stops click propagation so it never
 * triggers `itemClick` or closes the dropdown.
 *
 * @example
 * ```html
 * <lib-dropdown-menu-item [selected]="true" (itemClick)="onSelect()">
 *   Item Label
 *   <div actions>
 *     <button (click)="onEdit()">Edit</button>
 *     <button (click)="onDelete()">Delete</button>
 *   </div>
 * </lib-dropdown-menu-item>
 * ```
 */
@Component({
  selector: 'lib-dropdown-menu-item',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <button 
      class="dropdown-menu-item" 
      [class.selected]="selected()"
      [attr.data-testid]="testId()"
      [attr.tabindex]="0"
      (click)="handleClick($event)"
      (keydown.enter)="handleClick($event)"
      (keydown.space)="handleClick($event)"
      type="button"
    >
      @if (selected()) {
        <mat-icon class="check-icon">check</mat-icon>
      }
      <span class="item-label"><ng-content></ng-content></span>
      <div 
        class="item-actions" 
        tabindex="0" 
        role="button"
        (click)="handleActionsClick($event)"
        (keydown.enter)="handleActionsClick($event)"
        (keydown.space)="handleActionsClick($event)">
        <ng-content select="[actions]"></ng-content>
      </div>
    </button>
  `,
  styleUrl: './dropdown-menu-item.component.scss'
})
export class DropdownMenuItemComponent {
  private readonly parentDropdown = inject(DropdownMenuComponent, { optional: true });

  /**
   * Whether this item represents the current selection (default: `false`). Renders a leading
   * `check` icon when `true`.
   */
  selected = input<boolean>(false);

  /**
   * `data-testid` attribute applied to the item's button, for e2e targeting
   * (default: `''` — no attribute value set).
   */
  testId = input<string>('');

  /**
   * Whether to automatically close the parent dropdown on click (default: `true`). Set `false`
   * for items that shouldn't dismiss the menu, e.g. a toggle.
   */
  autoClose = input<boolean>(true);

  /**
   * Emitted with the triggering click/keyboard event when the item (not its `[actions]` slot)
   * is activated.
   */
  itemClick = output<Event>();

  handleClick(event: Event): void {
    this.itemClick.emit(event);
    
    // Auto-close parent dropdown after emitting the click
    if (this.autoClose() && this.parentDropdown) {
      this.parentDropdown.close();
    }
  }

  /**
   * Prevents events from actions area from bubbling to parent item.
   * This prevents itemClick emission when action buttons are clicked.
   */
  handleActionsClick(event: Event): void {
    event.stopPropagation();
  }
}
