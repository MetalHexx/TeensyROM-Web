import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormGroup, AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ScalingCardComponent, IconLabelComponent } from '@teensyrom-nx/ui/components';
import { SettingsToggleItemComponent } from '../settings-toggle-item/settings-toggle-item.component';
import { AudioSettingsSectionComponent } from '../audio-settings-section/audio-settings-section.component';
import { AudioInputDeviceListComponent } from '../audio-settings-section/audio-input-device-list/audio-input-device-list.component';
import { Device, DeviceState } from '@teensyrom-nx/domain';

/**
 * A device settings card: a device from the device list joined to its settings form group.
 */
export interface DeviceSettingsCard {
  device: Device;
  group: FormGroup;
  /** Whether `group` is a saved entry in `knownDevicesArray` (false for a detached default). */
  hasEntry: boolean;
  isOnline: boolean;
}

/**
 * Presentational component for per-device settings section.
 * Displays a card for each device in the device list, joined to its settings form group.
 * Settings entries with no matching device are not rendered.
 *
 * @example
 * ```html
 * <lib-device-settings-section
 *   [knownDevicesArray]="getKnownDevices()"
 *   [devices]="devices()"
 *   [createDefaultGroup]="createDefaultDeviceGroup"
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
    AudioInputDeviceListComponent,
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
   * - audioSettings: FormGroup { enableAudioStream, audioDeviceIndex, ... }
   */
  knownDevicesArray = input.required<FormArray>();

  /**
   * Devices to render a card for (the device list is the source of cards and names).
   */
  devices = input.required<readonly Device[]>();

  /**
   * Builds the detached, disabled default FormGroup for a device that has no settings entry.
   */
  createDefaultGroup = input.required<(deviceId: string) => FormGroup>();

  /**
   * Controls whether this section's card is visible via animation
   */
  animationTrigger = input<boolean>(true);

  /**
   * Default groups already handed out, so a device's fallback group keeps its identity
   * across device list updates (e.g. renames).
   */
  private readonly defaultGroups = new Map<string, FormGroup>();

  /**
   * One card per device - online devices first, then by name, then by deviceId.
   */
  readonly cards = computed<DeviceSettingsCard[]>(() => {
    const controls = this.knownDevicesArray().controls;
    const createDefaultGroup = this.createDefaultGroup();

    const cards = this.devices().map((device): DeviceSettingsCard => {
      const entry = controls.find((c) => c.get('deviceId')?.value === device.deviceId);
      return {
        device,
        group: entry ? (entry as FormGroup) : this.getDefaultGroup(device.deviceId, createDefaultGroup),
        hasEntry: !!entry,
        isOnline: device.deviceState !== DeviceState.ConnectionLost,
      };
    });

    return cards.sort(
      (a, b) =>
        Number(b.isOnline) - Number(a.isOnline) ||
        a.device.name.localeCompare(b.device.name) ||
        a.device.deviceId.localeCompare(b.device.deviceId)
    );
  });

  private getDefaultGroup(
    deviceId: string,
    createDefaultGroup: (deviceId: string) => FormGroup
  ): FormGroup {
    let group = this.defaultGroups.get(deviceId);
    if (!group) {
      group = createDefaultGroup(deviceId);
      this.defaultGroups.set(deviceId, group);
    }
    return group;
  }

  /**
   * Gets the enableVideo form control from a device FormGroup.
   */
  getEnableVideoControl(deviceGroup: AbstractControl): AbstractControl | null {
    return deviceGroup.get('videoSettings.enableVideo');
  }

  /**
   * Checks if a card's device is disabled (not enabled in device store).
   */
  isDeviceDisabled(card: DeviceSettingsCard): boolean {
    return !card.device.isEnabled;
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
