import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { ActionButtonComponent } from '../action-button/action-button.component';
import { StyledIconComponent } from '../styled-icon/styled-icon.component';
import { TooltipConfig, TooltipPosition } from '../tooltip/tooltip.directive';

@Component({
  selector: 'lib-confirmation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    IconButtonComponent,
    ActionButtonComponent,
    StyledIconComponent,
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

  /** Icon for the confirm action. Defaults to the icon-only form's hardcoded trash icon. */
  confirmIcon = input<string>('delete');
  /** Icon for the cancel action. Defaults to the icon-only form's hardcoded close icon. */
  cancelIcon = input<string>('close');
  /** Renders two labelled `lib-action-button` actions instead of icon-only buttons. */
  showLabels = input<boolean>(false);

  // Output events
  confirmed = output<void>();
  cancelled = output<void>();

  // Tooltip configurations
  readonly confirmTooltip = computed<TooltipConfig>(() => ({
    body: this.confirmLabel(),
    position: TooltipPosition.Top,
  }));

  readonly cancelTooltip = computed<TooltipConfig>(() => ({
    body: this.cancelLabel(),
    position: TooltipPosition.Top,
  }));

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
