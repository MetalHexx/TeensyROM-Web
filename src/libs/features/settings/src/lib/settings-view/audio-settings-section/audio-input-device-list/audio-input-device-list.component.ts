import { Component, ChangeDetectionStrategy, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { IconLabelComponent } from '@teensyrom-nx/ui/components';
import { AudioStore } from '@teensyrom-nx/application';
import { AudioDevice } from '@teensyrom-nx/domain';

/**
 * Displays the list of available audio input devices and emits the selected
 * device on click. Reads device/loading/error state directly from the shared
 * root-level AudioStore, which is already loaded by the sibling
 * AudioSettingsSectionComponent.
 */
@Component({
  selector: 'lib-audio-input-device-list',
  standalone: true,
  imports: [CommonModule, MatIconModule, IconLabelComponent],
  templateUrl: './audio-input-device-list.component.html',
  styleUrl: './audio-input-device-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioInputDeviceListComponent {
  readonly audioStore = inject(AudioStore);

  /** Whether the list should appear dimmed and non-interactive (e.g. audio streaming disabled) */
  disabled = input(false);

  /** Emitted when the user selects a device from the list */
  deviceSelected = output<AudioDevice>();

  isSelected(device: AudioDevice): boolean {
    return this.audioStore.selectedDeviceIndex() === device.index;
  }

  selectDevice(device: AudioDevice): void {
    this.deviceSelected.emit(device);
  }
}
