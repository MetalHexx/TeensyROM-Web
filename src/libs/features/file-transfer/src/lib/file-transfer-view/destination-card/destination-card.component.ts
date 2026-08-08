import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DeviceStore, TransferStore } from '@teensyrom-nx/application';
import { DeviceState } from '@teensyrom-nx/domain';
import { ScalingCardComponent, StatusIconLabelComponent } from '@teensyrom-nx/ui/components';
import { DeviceSelectorComponent } from './device-selector/device-selector.component';
import { DropzonePlaceholderComponent } from './dropzone-placeholder/dropzone-placeholder.component';

const IDLE_DEVICE_STATES: ReadonlySet<DeviceState> = new Set([
  DeviceState.Connected,
  DeviceState.Connectable,
]);

/**
 * Card shell for the transfer destination: device selector, idle status
 * indicator, and the dropzone placeholder, top to bottom.
 */
@Component({
  selector: 'lib-destination-card',
  imports: [
    ScalingCardComponent,
    DeviceSelectorComponent,
    StatusIconLabelComponent,
    DropzonePlaceholderComponent,
  ],
  templateUrl: './destination-card.component.html',
  styleUrl: './destination-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinationCardComponent {
  private readonly deviceStore = inject(DeviceStore);
  private readonly transferStore = inject(TransferStore);

  readonly enabledDevices = computed(() => this.deviceStore.devices().filter((d) => d.isEnabled));
  readonly targetDeviceId = this.transferStore.getTargetDeviceId();
  readonly targetDevice = computed(
    () => this.enabledDevices().find((d) => d.deviceId === this.targetDeviceId()) ?? null
  );

  /** Passive read of the target device's connection state — issues no API call or device command. */
  readonly isIdle = computed(() => {
    const device = this.targetDevice();
    return device ? IDLE_DEVICE_STATES.has(device.deviceState) : undefined;
  });
}
