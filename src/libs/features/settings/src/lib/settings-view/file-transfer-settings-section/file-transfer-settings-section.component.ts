import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ScalingCardComponent } from '@teensyrom-nx/ui/components';
import { SettingsToggleItemComponent } from '../settings-toggle-item/settings-toggle-item.component';

/**
 * Presentational component for file transfer settings section.
 * Displays directory paths, auto-copy toggles, and synchronization options.
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
    MatFormFieldModule,
    MatInputModule,
    ScalingCardComponent,
    SettingsToggleItemComponent,
  ],
  templateUrl: './file-transfer-settings-section.component.html',
  styleUrl: './file-transfer-settings-section.component.scss',
})
export class FileTransferSettingsSectionComponent {
  /**
   * FormGroup containing file transfer settings controls:
   * - watchDirectoryLocation: FormControl<string> (absolute path or empty)
   * - autoTransferPath: FormControl<string> (required)
   * - autoFileCopyEnabled: FormControl<boolean>
   * - autoLaunchOnCopyEnabled: FormControl<boolean>
   * - navToDirOnLaunch: FormControl<boolean>
   * - syncFilesEnabled: FormControl<boolean>
   */
  formGroup = input.required<FormGroup>();

  /**
   * Controls whether this section's card is visible via animation
   */
  animationTrigger = input<boolean>(true);
}
