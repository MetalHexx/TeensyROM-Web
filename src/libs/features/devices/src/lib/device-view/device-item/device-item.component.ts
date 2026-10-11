import { Component, input, computed, inject, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NgClass } from '@angular/common';
import {
  DEVICE_NAME_MAX_LENGTH,
  Device,
  DeviceHardwareVariant,
  DeviceMachine,
  DeviceState,
  DeviceVideoStandard,
  StorageType,
  validateDeviceName,
} from '@teensyrom-nx/domain';
import {
  IconLabelComponent,
  IconButtonComponent,
  InlineEditTitleComponent,
  ScalingCardComponent,
  TooltipConfig,
  TooltipPosition,
} from '@teensyrom-nx/ui/components';
import { StorageStatusComponent as StorageItemComponent } from '../storage-item/storage-item.component';
import { DeviceStore } from '@teensyrom-nx/application';

/** A request to rename a device, carrying the already-trimmed new name. */
export interface DeviceRenameRequest {
  deviceId: string;
  name: string;
}

const HARDWARE_LABELS: Partial<Record<DeviceHardwareVariant, string>> = {
  [DeviceHardwareVariant.TeensyRom]: 'TeensyROM',
  [DeviceHardwareVariant.TeensyRomPlus]: 'TeensyROM+',
};

@Component({
  selector: 'lib-device-item',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    NgClass,
    IconLabelComponent,
    IconButtonComponent,
    InlineEditTitleComponent,
    ScalingCardComponent,
    StorageItemComponent,
  ],
  templateUrl: './device-item.component.html',
  styleUrl: './device-item.component.scss',
})
export class DeviceItemComponent {
  device = input<Device>();
  /** Whether a reconnect attempt for this device is currently in flight. */
  reconnecting = input<boolean>(false);
  /** Whether a rename of this device is currently being saved; locks the title editor. */
  saving = input<boolean>(false);
  enable = output<string>();
  disable = output<string>();
  reconnect = output<string>();
  forget = output<string>();
  /** Emits the trimmed new name when the user commits a valid, changed title. */
  rename = output<DeviceRenameRequest>();
  private readonly deviceStore = inject(DeviceStore);

  readonly DEVICE_NAME_MAX_LENGTH = DEVICE_NAME_MAX_LENGTH;
  readonly nameInvalidDescription = `Name must be 1–${DEVICE_NAME_MAX_LENGTH} characters.`;
  readonly isValidName = (draft: string): boolean => validateDeviceName(draft).valid;

  readonly isEnabled = computed(() => this.device()?.isEnabled ?? true);
  readonly isOffline = computed(() => this.device()?.deviceState === DeviceState.ConnectionLost);
  readonly usbStatus = computed(() => this.device()?.usbStorage?.available);
  readonly sdStatus = computed(() => this.device()?.sdStorage?.available);
  
  /** USB storage index status (defaults to true for backward compatibility). */
  readonly usbIndexExists = computed(() => 
    this.device()?.usbStorage?.indexExists ?? true
  );

  /** SD storage index status (defaults to true for backward compatibility). */
  readonly sdIndexExists = computed(() => 
    this.device()?.sdStorage?.indexExists ?? true
  );
  
  /** Host machine, or `null` when unknown or offline (offline listings carry no machine). */
  readonly machineLabel = computed(() => {
    const machine = this.device()?.machine;
    return !this.isOffline() && machine && machine !== DeviceMachine.Unknown ? machine : null;
  });

  /** Video standard, or `null` when unknown or offline. */
  readonly videoLabel = computed(() => {
    const video = this.device()?.videoStandard;
    return !this.isOffline() && video && video !== DeviceVideoStandard.Unknown ? video : null;
  });

  /** TOD clock rate, or `null` when unknown or offline. */
  readonly clockLabel = computed(() => {
    const hz = this.device()?.todClockHz;
    return !this.isOffline() && hz != null ? `${hz} Hz` : null;
  });

  /** Cartridge hardware revision, or `null` when unknown. Still shown while offline. */
  readonly hardwareLabel = computed(() => {
    const variant = this.device()?.hardwareVariant;
    return (variant && HARDWARE_LABELS[variant]) || null;
  });

  readonly StorageType = StorageType;

  readonly enabledTooltip: TooltipConfig = {
    title: 'Disable Device',
    body: 'Device will be unavailable in other parts of the application like the player view.',
    position: TooltipPosition.Top,
  };

  readonly disabledTooltip: TooltipConfig = {
    title: 'Enable Device',
    body: 'Device will be available in other parts of the application like the player view.',
    position: TooltipPosition.Top,
  };

  readonly reconnectTooltip: TooltipConfig = {
    title: 'Reconnect',
    body: "Try this device's saved addresses, then search for it.",
    position: TooltipPosition.Top,
  };

  readonly forgetTooltip: TooltipConfig = {
    title: 'Forget Device',
    body: 'Remove it from this list. Discover Devices finds it again.',
    position: TooltipPosition.Top,
  };

  readonly toggleTooltip = computed(() =>
    this.isEnabled() ? this.enabledTooltip : this.disabledTooltip
  );

  /** Reconnect tooltip while offline, the usual enable/disable tooltip otherwise. */
  readonly powerTooltip = computed(() => (this.isOffline() ? this.reconnectTooltip : this.toggleTooltip()));

  /** The power button never highlights while offline - there is no "enabled" state to show. */
  readonly powerColor = computed(() => (this.isOffline() ? 'normal' : this.isEnabled() ? 'highlight' : 'normal'));

  readonly offlineLabel = computed(() => (this.reconnecting() ? 'Reconnecting…' : 'Offline'));

  /** Reconnects an offline device, otherwise toggles enable/disable as usual. */
  onPowerClick(): void {
    if (this.isOffline()) {
      this.reconnect.emit(this.device()?.deviceId ?? '');
      return;
    }
    this.onToggleEnabled();
  }

  onToggleEnabled() {
    const deviceId = this.device()?.deviceId ?? '';
    if (this.isEnabled()) {
      this.disable.emit(deviceId);
    } else {
      this.enable.emit(deviceId);
    }
  }

  onForget(): void {
    this.forget.emit(this.device()?.deviceId ?? '');
  }

  onRename(name: string): void {
    this.rename.emit({ deviceId: this.device()?.deviceId ?? '', name });
  }

  async onIndex(storageType: StorageType) {
    const deviceId = this.device()?.deviceId ?? '';
    await this.deviceStore.indexStorage(deviceId, storageType);
  }
}
