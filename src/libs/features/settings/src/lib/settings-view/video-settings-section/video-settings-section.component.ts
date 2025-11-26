import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ScalingCardComponent } from '@teensyrom-nx/ui/components';
import { SettingsToggleItemComponent } from '../settings-toggle-item/settings-toggle-item.component';

/**
 * Presentational component for video settings section.
 * Displays video capture enable/disable toggle control.
 *
 * @example
 * ```html
 * <lib-video-settings-section
 *   [formGroup]="settingsForm().get('videoSettings')"
 * ></lib-video-settings-section>
 * ```
 */
@Component({
  selector: 'lib-video-settings-section',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ScalingCardComponent,
    SettingsToggleItemComponent,
  ],
  templateUrl: './video-settings-section.component.html',
  styleUrl: './video-settings-section.component.scss',
})
export class VideoSettingsSectionComponent {
  /**
   * FormGroup containing video settings controls:
   * - enableVideo: FormControl<boolean>
   */
  formGroup = input.required<FormGroup>();

  /**
   * Controls whether this section's card is visible via animation
   */
  animationTrigger = input<boolean>(true);
}
