import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { ActionButtonComponent } from '../action-button/action-button.component';
import { StyledIconComponent } from '../styled-icon/styled-icon.component';
import { TooltipConfig, TooltipPosition } from '../tooltip/tooltip.directive';

/**
 * A plain presentational yes/no confirmation prompt — no internal open/close state, no
 * overlay of its own. It renders `title`/`message` text plus a confirm/cancel action
 * pair (icon-only by default, or two labelled `lib-action-button`s via `showLabels`), and
 * both actions carry a `[libTooltip]` naming the action label. Because it owns no
 * positioning, project it inside `DropdownDialogComponent` (or a Material dialog) to
 * appear near the trigger that opened it — call `.close()` on the wrapper from the
 * `confirmed`/`cancelled` handlers.
 *
 * @example
 * ```html
 * <lib-dropdown-dialog #confirmDialog>
 *   <button (click)="confirmDialog.open()">Delete</button>
 *   <div dialog-content>
 *     <lib-confirmation-dialog
 *       title="Delete Preset"
 *       message="This action cannot be undone."
 *       (confirmed)="onDelete(); confirmDialog.close()"
 *       (cancelled)="confirmDialog.close()"
 *     ></lib-confirmation-dialog>
 *   </div>
 * </lib-dropdown-dialog>
 * ```
 */
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
  /** Heading text (default: `'Confirm Action'`). */
  title = input<string>('Confirm Action');
  /**
   * Supporting body text explaining the consequence of confirming
   * (default: `''` — no message rendered).
   */
  message = input<string>('');
  /**
   * Label for the confirm action; also used as the confirm button's tooltip body when
   * `showLabels` is `false` (default: `'Delete'`).
   */
  confirmLabel = input<string>('Delete');
  /**
   * Label for the cancel action; also used as the cancel button's tooltip body when
   * `showLabels` is `false` (default: `'Cancel'`).
   */
  cancelLabel = input<string>('Cancel');

  /** Icon for the confirm action. Defaults to the icon-only form's hardcoded trash icon. */
  confirmIcon = input<string>('delete');
  /** Icon for the cancel action. Defaults to the icon-only form's hardcoded close icon. */
  cancelIcon = input<string>('close');
  /** Renders two labelled `lib-action-button` actions instead of icon-only buttons. */
  showLabels = input<boolean>(false);

  // Output events
  /**
   * Emitted when the confirm action is activated (click or Enter). The dialog does not close
   * itself — the handler must dismiss whatever wraps it.
   */
  confirmed = output<void>();
  /**
   * Emitted when the cancel action is activated (click or Escape). The dialog does not close
   * itself — the handler must dismiss whatever wraps it.
   */
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
