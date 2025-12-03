import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DropdownMenuComponent } from './dropdown-menu.component';

/**
 * Menu item component for use with lib-dropdown-menu.
 * Provides consistent styling and interaction for dropdown menu items.
 * Automatically closes the parent dropdown when clicked unless autoClose is false.
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
      (click)="handleClick($event)"
      type="button"
    >
      @if (selected()) {
        <mat-icon class="check-icon">check</mat-icon>
      }
      <span class="item-label"><ng-content></ng-content></span>
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
  itemClick = output<MouseEvent>();

  handleClick(event: MouseEvent): void {
    this.itemClick.emit(event);
    
    // Auto-close parent dropdown after emitting the click
    if (this.autoClose() && this.parentDropdown) {
      this.parentDropdown.close();
    }
  }
}
