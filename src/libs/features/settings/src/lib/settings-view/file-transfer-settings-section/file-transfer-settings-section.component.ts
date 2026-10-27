import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ScalingCardComponent } from '@teensyrom-nx/ui/components';
import { SettingsToggleItemComponent } from '../settings-toggle-item/settings-toggle-item.component';

/**
 * Presentational component for file transfer settings section.
 * Displays the auto-launch toggle.
 *
 * @example
 * ```html
 * <lib-file-transfer-settings-section
 *   [formGroup]="settingsForm().get('fileTransferSettings')"
 * ></lib-file-transfer-settings-section>
 * ```
 */
@Component({
  selector: 'lib-file-transfer-settings-section',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ScalingCardComponent,
    SettingsToggleItemComponent,
  ],
  templateUrl: './file-transfer-settings-section.component.html',
  styleUrl: './file-transfer-settings-section.component.scss',
})
export class FileTransferSettingsSectionComponent {
  /**
   * FormGroup containing file transfer settings controls:
   * - autoLaunchOnCopyEnabled: FormControl<boolean>
   */
  formGroup = input.required<FormGroup>();

  /**
   * Controls whether this section's card is visible via animation
   */
  animationTrigger = input<boolean>(true);
}
