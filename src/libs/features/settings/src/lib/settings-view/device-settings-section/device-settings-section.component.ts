import { Component, input, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormGroup, AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ScalingCardComponent, IconLabelComponent } from '@teensyrom-nx/ui/components';
import { SettingsToggleItemComponent } from '../settings-toggle-item/settings-toggle-item.component';
import { AudioSettingsSectionComponent } from '../audio-settings-section/audio-settings-section.component';
import { Device } from '@teensyrom-nx/domain';
import { AudioStore } from '@teensyrom-nx/application';

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
    AudioSettingsSectionComponent,
  ],
  templateUrl: './device-settings-section.component.html',
  styleUrl: './device-settings-section.component.scss',
})
export class DeviceSettingsSectionComponent {
  readonly audioStore = inject(AudioStore);

  /**
   * FormArray containing device settings FormGroups.
   * Each FormGroup contains:
   * - deviceId: FormControl<string>
   * - videoSettings: FormGroup { enableVideo: FormControl<boolean>, videoDeviceId: FormControl<string> }
   * - connectionSettings: FormGroup { autoConnectEnabled: FormControl<boolean> }
   */
  knownDevicesArray = input.required<FormArray>();

  /**
   * Map of deviceId to Device object for status lookups
   */
  deviceMap = input<Map<string, Device>>(new Map());

  /**
   * Controls whether this section's card is visible via animation
   */
  animationTrigger = input<boolean>(true);

  /**
   * Sorted device controls - online devices first, then alphabetically by deviceId
   */
  readonly sortedDeviceControls = computed(() => {
    const controls = this.knownDevicesArray().controls;
    const deviceMap = this.deviceMap();

    return [...controls].sort((a, b) => {
      const deviceIdA = a.get('deviceId')?.value ?? '';
      const deviceIdB = b.get('deviceId')?.value ?? '';
      
      const deviceA = deviceMap.get(deviceIdA);
      const deviceB = deviceMap.get(deviceIdB);
      
      const isOnlineA = deviceA?.deviceState === 'Connected';
      const isOnlineB = deviceB?.deviceState === 'Connected';
      
      // Online devices first
      if (isOnlineA && !isOnlineB) return -1;
      if (!isOnlineA && isOnlineB) return 1;
      
      // Then alphabetically by deviceId
      return deviceIdA.localeCompare(deviceIdB);
    });
  });

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
   * Gets the Device object for a given device FormGroup.
   */
  getDevice(deviceGroup: AbstractControl): Device | undefined {
    const deviceId = deviceGroup.get('deviceId')?.value;
    return this.deviceMap().get(deviceId);
  }

  /**
   * Checks if a device is disabled (not enabled in device store).
   */
  isDeviceDisabled(deviceGroup: AbstractControl): boolean {
    const device = this.getDevice(deviceGroup);
    return device ? !device.isEnabled : true;
  }

  /**
   * Checks if a device is currently online/connected.
   * Uses deviceState === 'Connected' for more accurate status.
   */
  isDeviceOnline(deviceGroup: AbstractControl): boolean {
    const device = this.getDevice(deviceGroup);
    return device?.deviceState === 'Connected';
  }

  /**
   * Gets the audio settings FormGroup from a device FormGroup.
   */
  getAudioSettings(deviceGroup: AbstractControl): FormGroup | null {
    return deviceGroup.get('audioSettings') as FormGroup | null;
  }

  /**
   * Gets the saved audio device index from a device FormGroup.
   * Returns -1 if no audio settings or no device configured.
   */
  getAudioDeviceIndex(deviceGroup: AbstractControl): number {
    return deviceGroup.get('audioSettings.audioDeviceIndex')?.value ?? -1;
  }

  /**
   * Gets the TeensyROM device ID from a device FormGroup.
   */
  getDeviceId(deviceGroup: AbstractControl): string {
    return deviceGroup.get('deviceId')?.value ?? '';
  }

  /**
   * Gets the numeric index of a device in the FormArray.
   */
  getDeviceIndex(deviceGroup: AbstractControl): number {
    return this.knownDevicesArray().controls.indexOf(deviceGroup);
  }
}
