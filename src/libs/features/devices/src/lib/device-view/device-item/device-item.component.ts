import { Component, input, computed, inject, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NgClass } from '@angular/common';
import {
  Device,
  StorageType,
} from '@teensyrom-nx/domain';
import {
  IconLabelComponent,
  IconButtonComponent,
  ScalingCardComponent,
  TooltipConfig,
  TooltipPosition,
} from '@teensyrom-nx/ui/components';
import { StorageStatusComponent as StorageItemComponent } from '../storage-item/storage-item.component';
import { DeviceStore } from '@teensyrom-nx/application';

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
    ScalingCardComponent,
    StorageItemComponent,
  ],
  templateUrl: './device-item.component.html',
  styleUrl: './device-item.component.scss',
})
export class DeviceItemComponent {
  device = input<Device>();
  enable = output<string>();
  disable = output<string>();
  private readonly deviceStore = inject(DeviceStore);

  readonly isEnabled = computed(() => this.device()?.isEnabled ?? true);
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

  readonly toggleTooltip = computed(() => 
    this.isEnabled() ? this.enabledTooltip : this.disabledTooltip
  );

  onToggleEnabled() {
    const deviceId = this.device()?.deviceId ?? '';
    if (this.isEnabled()) {
      this.disable.emit(deviceId);
    } else {
      this.enable.emit(deviceId);
    }
  }

  async onIndex(storageType: StorageType) {
    const deviceId = this.device()?.deviceId ?? '';
    await this.deviceStore.indexStorage(deviceId, storageType);
  }
}
