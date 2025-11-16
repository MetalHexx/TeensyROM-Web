import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ScalingCardComponent } from '@teensyrom-nx/ui/components';
import { SettingsToggleItemComponent } from '../settings-toggle-item/settings-toggle-item.component';

/**
 * Presentational component for application settings section.
 * Displays minimal app-level settings (currently only setup completion).
 *
 * @example
 * ```html
 * <lib-app-settings-section
 *   [formGroup]="settingsForm().get('appSettings')"
 * ></lib-app-settings-section>
 * ```
 */
@Component({
  selector: 'lib-app-settings-section',
  imports: [CommonModule, ReactiveFormsModule, ScalingCardComponent, SettingsToggleItemComponent],
  templateUrl: './app-settings-section.component.html',
  styleUrl: './app-settings-section.component.scss',
})
export class AppSettingsSectionComponent {
  /**
   * FormGroup containing app settings controls:
   * - setupCompleted: FormControl<boolean>
   */
  formGroup = input.required<FormGroup>();
}
