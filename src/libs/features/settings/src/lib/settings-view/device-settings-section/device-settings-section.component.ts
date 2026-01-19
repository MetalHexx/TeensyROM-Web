import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormGroup, AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ScalingCardComponent, IconLabelComponent } from '@teensyrom-nx/ui/components';
import { SettingsToggleItemComponent } from '../settings-toggle-item/settings-toggle-item.component';

/**
 * Presentational component for per-device settings section.
 * Displays a card for each known device with video and connection toggles.
 *
 * @example
 * ```html
 * <lib-device-settings-section
 *   [knownDevicesArray]="getKnownDevices()"
 *   [animationTrigger]="activeSection() === 'devices'"
 * ></lib-device-settings-section>
 * ```
 */
@Component({
  selector: 'lib-device-settings-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    ScalingCardComponent,
    IconLabelComponent,
    SettingsToggleItemComponent,
  ],
  templateUrl: './device-settings-section.component.html',
  styleUrl: './device-settings-section.component.scss',
})
export class DeviceSettingsSectionComponent {
  /**
   * FormArray containing device settings FormGroups.
   * Each FormGroup contains:
   * - deviceId: FormControl<string>
   * - videoSettings: FormGroup { enableVideo: FormControl<boolean>, videoDeviceId: FormControl<string> }
   * - connectionSettings: FormGroup { autoConnectEnabled: FormControl<boolean> }
   */
  knownDevicesArray = input.required<FormArray>();

  /**
   * Controls whether this section's card is visible via animation
   */
  animationTrigger = input<boolean>(true);

  /**
   * Gets a display-friendly title for a device card.
   * Truncates long device IDs for readability.
   */
  getDeviceTitle(deviceGroup: AbstractControl): string {
    const deviceId = deviceGroup.get('deviceId')?.value ?? 'Unknown';
    const fullLabel = `Device: ${deviceId}`;
    return fullLabel.length > 25 ? `Device: ${deviceId.slice(0, 12)}...` : fullLabel;
  }

  /**
   * Casts AbstractControl to FormGroup for template usage.
   */
  asFormGroup(control: AbstractControl): FormGroup {
    return control as FormGroup;
  }

  /**
   * Gets the enableVideo form control from a device FormGroup.
   */
  getEnableVideoControl(deviceGroup: AbstractControl): AbstractControl | null {
    return deviceGroup.get('videoSettings.enableVideo');
  }

  /**
   * Gets the autoConnectEnabled form control from a device FormGroup.
   */
  getAutoConnectControl(deviceGroup: AbstractControl): AbstractControl | null {
    return deviceGroup.get('connectionSettings.autoConnectEnabled');
  }
}
