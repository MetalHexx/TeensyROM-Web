import { Component, input } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

/**
 * Reusable toggle component for settings forms.
 * Provides consistent styling and layout for all settings toggles.
 */
@Component({
  selector: 'lib-settings-toggle-item',
  standalone: true,
  imports: [MatSlideToggleModule, ReactiveFormsModule],
  templateUrl: './settings-toggle-item.component.html',
  styleUrl: './settings-toggle-item.component.scss',
})
export class SettingsToggleItemComponent {
  /**
   * The label text displayed next to the toggle switch
   */
  label = input.required<string>();

  /**
   * The description text displayed below the toggle
   */
  description = input.required<string>();

  /**
   * The form control for the toggle's boolean value.
   * Accepts AbstractControl to work with FormGroup.controls['controlName']
   */
  control = input.required<AbstractControl>();

  /**
   * Whether the toggle is disabled
   */
  disabled = input<boolean>(false);

  /**
   * Optional aria-label override for accessibility
   */
  ariaLabel = input<string | undefined>(undefined);

  /**
   * Casts the AbstractControl to FormControl for template binding.
   * This is safe because we know the control is a FormControl<boolean> from the form structure.
   */
  get formControl(): FormControl {
    return this.control() as FormControl;
  }
}
