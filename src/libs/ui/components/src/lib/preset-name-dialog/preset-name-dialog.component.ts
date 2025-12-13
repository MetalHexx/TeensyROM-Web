import { Component, input, output, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ScalingCompactCardComponent } from '../scaling-compact-card/scaling-compact-card.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';

/**
 * Validation function type for preset names.
 * Returns an error message string if invalid, or empty string if valid.
 */
export type PresetNameValidationFn = (name: string, existingNames: string[]) => string;

/**
 * Dialog component for entering and validating custom preset names.
 * 
 * Features:
 * - Real-time validation with error messages
 * - Character counter (50 character limit)
 * - Keyboard navigation (Enter to save, Escape to cancel)
 * - Pre-filled initial values for rename scenarios
 * 
 * @example
 * ```typescript
 * <lib-preset-name-dialog
 *   [title]="'Rename Preset'"
 *   [initialValue]="currentPresetName"
 *   [reservedNames]="existingPresetNames"
 *   [validationFn]="validatePresetName"
 *   (confirmed)="onPresetNameConfirmed($event)"
 *   (cancelled)="onDialogCancelled()"
 * />
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
    ScalingCompactCardComponent,
    IconButtonComponent,
  ],
  templateUrl: './preset-name-dialog.component.html',
  styleUrl: './preset-name-dialog.component.scss',
})
export class PresetNameDialogComponent implements OnInit {
  // Input properties
  /** Dialog title (defaults to 'Save Preset') */
  title = input<string>('Save Preset');
  
  /** Initial value for the name input (used for rename scenarios) */
  initialValue = input<string>('');
  
  /** Array of reserved/existing preset names to prevent duplicates */
  reservedNames = input<string[]>([]);
  
  /** Validation function that returns error message or empty string */
  validationFn = input.required<PresetNameValidationFn>();

  // Output events
  /** Emitted when user confirms with a valid name (trimmed) */
  confirmed = output<string>();
  
  /** Emitted when user cancels the dialog */
  cancelled = output<void>();

  // Component state
  /** Current value of the name input field */
  currentName = signal<string>('');

  // Computed signals
  /** 
   * Validation error message, or empty string if valid.
   * Computed by calling the validation function with current state.
   */
  validationError = computed<string>(() => {
    const name = this.currentName();
    const reserved = this.reservedNames();
    const validateFn = this.validationFn();
    return validateFn(name, reserved);
  });

  /**
   * Character counter showing current/max format (e.g., "25/50").
   */
  remainingChars = computed<string>(() => {
    const length = this.currentName().length;
    return `${length}/50`;
  });

  /**
   * Whether the save button should be enabled.
   * Requires: no validation error AND non-empty name (after trim).
   */
  canSave = computed<boolean>(() => {
    return this.validationError() === '' && this.currentName().trim() !== '';
  });

  // Lifecycle hooks
  ngOnInit(): void {
    // Initialize currentName with initialValue for rename scenarios
    this.currentName.set(this.initialValue());
  }

  // Event handlers
  /**
   * Handles save button click.
   * Only emits if canSave is true, emits trimmed name.
   */
  onSaveClick(): void {
    if (!this.canSave()) return;
    this.confirmed.emit(this.currentName().trim());
  }

  /**
   * Handles cancel button click.
   * Emits cancelled event.
   */
  onCancelClick(): void {
    this.cancelled.emit();
  }

  /**
   * Handles keyboard navigation in the input field.
   * - Enter: Save if valid
   * - Escape: Cancel
   */
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
