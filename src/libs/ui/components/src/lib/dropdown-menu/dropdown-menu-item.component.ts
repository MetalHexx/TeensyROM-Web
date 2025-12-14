import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DropdownMenuComponent } from './dropdown-menu.component';

/**
 * Menu item component for use with lib-dropdown-menu.
 * Provides consistent styling and interaction for dropdown menu items.
 * Automatically closes the parent dropdown when clicked unless autoClose is false.
 * 
 * Supports composable actions via named content projection:
 * @example
 * ```html
 * <lib-dropdown-menu-item (itemClick)="onSelect()">
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

  selected = input<boolean>(false);
  testId = input<string>('');
  /** Whether to automatically close the parent dropdown on click. Defaults to true. */
  autoClose = input<boolean>(true);
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
