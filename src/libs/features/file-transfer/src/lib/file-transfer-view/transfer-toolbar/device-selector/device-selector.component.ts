import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DeviceStore, TransferStore } from '@teensyrom-nx/application';
import { Device } from '@teensyrom-nx/domain';
import {
  DropdownMenuComponent,
  DropdownMenuItemComponent,
  IconButtonComponent,
} from '@teensyrom-nx/ui/components';

/**
 * Dropdown that targets a device for the transfer. Offers only enabled
 * devices and writes the selection straight to `TransferStore`; it does not
 * resolve a default or manage any lifecycle concerns — the view owns those.
 */
@Component({
  selector: 'lib-device-selector',
  imports: [DropdownMenuComponent, DropdownMenuItemComponent, IconButtonComponent],
  templateUrl: './device-selector.component.html',
  styleUrl: './device-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceSelectorComponent {
  private readonly deviceStore = inject(DeviceStore);
  private readonly transferStore = inject(TransferStore);

  readonly enabledDevices = computed(() => this.deviceStore.devices().filter((d) => d.isEnabled));
  readonly targetDeviceId = this.transferStore.getTargetDeviceId();
  readonly targetDevice = computed(
    () => this.enabledDevices().find((d) => d.deviceId === this.targetDeviceId()) ?? null
  );

  onSelect(device: Device): void {
    this.transferStore.setTargetDevice({ deviceId: device.deviceId });
  }
}
