import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ScalingCardComponent } from '@teensyrom-nx/ui/components';

/**
 * Presentational component for player settings section.
 * Displays player-related toggles and startup filter dropdown.
 *
 * @example
 * ```html
 * <lib-player-settings-section
 *   [formGroup]="settingsForm().get('playerSettings')"
 * ></lib-player-settings-section>
 * ```
 */
@Component({
  selector: 'lib-player-settings-section',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    ScalingCardComponent,
  ],
  templateUrl: './player-settings-section.component.html',
  styleUrl: './player-settings-section.component.scss',
})
export class PlayerSettingsSectionComponent {
  /**
   * FormGroup containing player settings controls:
   * - repeatModeOnStartup: FormControl<boolean>
   * - playTimerEnabled: FormControl<boolean>
   * - muteFastForward: FormControl<boolean>
   * - muteRandomSeek: FormControl<boolean>
   * - startupFilter: FormControl<StartupFilterType>
   * - startupLaunchEnabled: FormControl<boolean>
   * - startupLaunchRandom: FormControl<boolean>
   */
  formGroup = input.required<FormGroup>();

  /**
   * Available startup filter options matching StartupFilterType
   */
  readonly startupFilterOptions = [
    { value: 'All', label: 'All Files' },
    { value: 'Games', label: 'Games Only' },
    { value: 'Music', label: 'Music Only' },
    { value: 'Hex', label: 'Hex Files Only' },
    { value: 'Images', label: 'Images Only' },
  ];
}
