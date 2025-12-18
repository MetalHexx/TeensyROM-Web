import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { IconButtonComponent } from '../icon-button/icon-button.component';

@Component({
  selector: 'lib-confirmation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    IconButtonComponent,
  ],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss',
})
export class ConfirmationDialogComponent {
  // Input properties
  title = input<string>('Confirm Action');
  message = input<string>('');
  confirmLabel = input<string>('Delete');
  cancelLabel = input<string>('Cancel');

  // Output events
  confirmed = output<void>();
  cancelled = output<void>();

  // Event handlers
  onConfirmClick(): void {
    this.confirmed.emit();
  }

  onCancelClick(): void {
    this.cancelled.emit();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onConfirmClick();
    } else if (event.key === 'Escape') {
      this.onCancelClick();
    }
  }
}
