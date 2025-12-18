import { Component, input, output, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { IconButtonComponent } from '../icon-button/icon-button.component';

/**
 * Validation function type for preset names.
 * Returns an error message string if invalid, or empty string if valid.
 */
export type PresetNameValidationFn = (name: string, existingNames: string[]) => string;

/**
 * Dialog for entering and validating preset names with real-time validation,
 * character counter, and keyboard navigation (Enter to save, Escape to cancel).
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
  title = input<string>('Save Preset');
  initialValue = input<string>('');
  reservedNames = input<string[]>([]);
  validationFn = input.required<PresetNameValidationFn>();

  confirmed = output<string>();
  cancelled = output<void>();

  currentName = signal<string>('');

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
