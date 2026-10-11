import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from '@teensyrom-nx/ui/components';
import { DeviceStore } from '@teensyrom-nx/application';
import { DeviceItemComponent } from './device-item/device-item.component';
import { DeviceLogsComponent } from './device-logs/device-logs.component';
import { DeviceToolbarComponent } from './device-toolbar/device-toolbar.component';

@Component({
  selector: 'lib-device-view',
  imports: [CommonModule, DeviceItemComponent, DeviceLogsComponent, DeviceToolbarComponent],
  templateUrl: './device-view.component.html',
  styleUrl: './device-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceViewComponent {
  private readonly deviceStore = inject(DeviceStore);
  private readonly dialog = inject(MatDialog);

  devices = this.deviceStore.devices;
  isLoading = this.deviceStore.isLoading;
  reconnectingDeviceIds = this.deviceStore.reconnectingDeviceIds;

  onEnable(deviceId: string) {
    this.deviceStore.enableDevice(deviceId);
  }

  onDisable(deviceId: string) {
    this.deviceStore.disableDevice(deviceId);
  }

  isReconnecting(deviceId: string): boolean {
    return this.reconnectingDeviceIds().includes(deviceId);
  }

  onReconnect(deviceId: string): void {
    void this.deviceStore.reconnectDevice(deviceId);
  }

  onForget(deviceId: string): void {
    const confirmRef = this.dialog.open(ConfirmationDialogComponent, {
      disableClose: true,
      panelClass: 'glassy-dialog',
      backdropClass: 'busy-dialog-backdrop',
    });

    confirmRef.componentRef?.setInput('title', 'Forget device?');
    confirmRef.componentRef?.setInput(
      'message',
      `${deviceId} will be removed from the list.\nDiscover Devices finds it again when it's connected.`
    );
    confirmRef.componentRef?.setInput('confirmLabel', 'Forget');
    confirmRef.componentRef?.setInput('cancelLabel', 'Cancel');
    confirmRef.componentRef?.setInput('showLabels', true);

    confirmRef.componentInstance.confirmed.subscribe(() => {
      confirmRef.close();
      void this.deviceStore.forgetDevice(deviceId);
    });
    confirmRef.componentInstance.cancelled.subscribe(() => {
      confirmRef.close();
    });
  }
}
