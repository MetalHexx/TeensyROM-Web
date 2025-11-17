import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ScalingCardComponent } from '@teensyrom-nx/ui/components';
import { SettingsToggleItemComponent } from '../settings-toggle-item/settings-toggle-item.component';

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
    ScalingCardComponent,
    SettingsToggleItemComponent,
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
   * - startupFilter: FormControl<PlayerFilterType>
   * - startupLaunchEnabled: FormControl<boolean>
   * - startupLaunchRandom: FormControl<boolean>
   */
  formGroup = input.required<FormGroup>();

  /**
   * Controls whether this section's card is visible via animation
   */
  animationTrigger = input<boolean>(true);

  /**
   * Available startup filter options matching PlayerFilterType
   */
  readonly startupFilterOptions = [
    { value: 'ALL', label: 'All Files' },
    { value: 'GAMES', label: 'Games Only' },
    { value: 'MUSIC', label: 'Music Only' },
    { value: 'HEX', label: 'Hex Files Only' },
    { value: 'IMAGES', label: 'Images Only' },
  ];
}
