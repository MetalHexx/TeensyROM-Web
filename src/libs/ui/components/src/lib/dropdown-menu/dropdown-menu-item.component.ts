import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

/**
 * Menu item component for use with lib-dropdown-menu.
 * Provides consistent styling and interaction for dropdown menu items.
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
  selected = input<boolean>(false);
  testId = input<string>('');
  itemClick = output<MouseEvent>();

  handleClick(event: MouseEvent): void {
    this.itemClick.emit(event);
  }
}
