import { Component, input, output, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { TooltipConfig, TooltipPosition } from '../tooltip/tooltip.directive';

/**
 * Validation function type for preset names.
 * Returns an error message string if invalid, or empty string if valid.
 */
export type PresetNameValidationFn = (name: string, existingNames: string[]) => string;

/**
 * A plain presentational text-entry dialog for entering and validating preset names, with
 * real-time validation via a caller-supplied `validationFn`, a character counter, and
 * keyboard navigation (Enter to save when valid, Escape to cancel). Like
 * `ConfirmationDialogComponent`, it has no internal open/close state or positioning of its
 * own — project it inside `DropdownDialogComponent`'s `[dialog-content]` slot to position
 * it near the trigger that opened it, and call the wrapper's `.close()` from the
 * `confirmed`/`cancelled` handlers.
 *
 * @example
 * ```html
 * <lib-dropdown-dialog #saveDialog>
 *   <button (click)="saveDialog.open()">Save preset</button>
 *   <div dialog-content>
 *     <lib-preset-name-dialog
 *       [reservedNames]="existingNames()"
 *       [validationFn]="validatePresetName"
 *       (confirmed)="onSave($event); saveDialog.close()"
 *       (cancelled)="saveDialog.close()"
 *     ></lib-preset-name-dialog>
 *   </div>
 * </lib-dropdown-dialog>
 * ```
 */
@Component({
  selector: 'lib-preset-name-dialog',
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    IconButtonComponent,
  ],
  templateUrl: './preset-name-dialog.component.html',
  styleUrl: './preset-name-dialog.component.scss',
})
export class PresetNameDialogComponent implements OnInit {
  /** Heading text (default: `'Save Preset'`). */
  title = input<string>('Save Preset');
  /**
   * Name pre-filled into the input on open, e.g. for renaming an existing preset
   * (default: `''` — empty input).
   */
  initialValue = input<string>('');
  /**
   * Names passed to `validationFn` as "already taken"; typically the caller's existing preset
   * name list (default: `[]`).
   */
  reservedNames = input<string[]>([]);
  /**
   * Validation callback run on every keystroke; return an error message string to block saving,
   * or `''` when the current name is valid. Required — no default.
   */
  validationFn = input.required<PresetNameValidationFn>();

  /**
   * Emitted with the trimmed name when Save is activated and `validationFn` currently
   * returns `''`.
   */
  confirmed = output<string>();
  /** Emitted when Cancel is activated (click or Escape). */
  cancelled = output<void>();

  currentName = signal<string>('');

  // Tooltip configurations
  readonly saveTooltip: TooltipConfig = {
    body: 'Save CRT preset',
    position: TooltipPosition.Top,
  };

  readonly cancelTooltip: TooltipConfig = {
    body: 'Cancel',
    position: TooltipPosition.Top,
  };

  validationError = computed<string>(() => {
    const name = this.currentName();
    const reserved = this.reservedNames();
    const validateFn = this.validationFn();
    return validateFn(name, reserved);
  });

  remainingChars = computed<string>(() => {
    const length = this.currentName().length;
    return `${length}/50`;
  });

  canSave = computed<boolean>(() => {
    return this.validationError() === '' && this.currentName().trim() !== '';
  });

  ngOnInit(): void {
    this.currentName.set(this.initialValue());
  }

  onSaveClick(): void {
    if (!this.canSave()) return;
    this.confirmed.emit(this.currentName().trim());
  }

  onCancelClick(): void {
    this.cancelled.emit();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.canSave()) {
        this.onSaveClick();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.onCancelClick();
    }
  }
}
