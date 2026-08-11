import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { DeviceStore, StorageStore, TransferStore, TRANSFER_CONTEXT, ITransferContext } from '@teensyrom-nx/application';
import { Device, DeviceState, StorageType } from '@teensyrom-nx/domain';
import { DropzoneCardComponent } from '../file-transfer-view/dropzone-card/dropzone-card.component';

const FIXTURE_DEVICE_ID = 'dev-fixture-device';

const FIXTURE_DEVICE: Device = {
  deviceId: FIXTURE_DEVICE_ID,
  comPort: 'COM3',
  name: 'Workbench TR',
  fwVersion: '1.0.0',
  isCompatible: true,
  isConnected: true,
  deviceState: DeviceState.Connected,
  isEnabled: true,
  sdStorage: { deviceId: FIXTURE_DEVICE_ID, type: StorageType.Sd, available: true, indexExists: true },
  usbStorage: { deviceId: FIXTURE_DEVICE_ID, type: StorageType.Usb, available: false, indexExists: false },
};

const NO_OP_TRANSFER_CONTEXT: ITransferContext = {
  startTransfer: async () => undefined,
  retryCreate: async () => undefined,
  cancelTransfer: async () => undefined,
  closeTransfer: async () => undefined,
  refreshDeviceBusyState: async () => undefined,
};

/**
 * Wraps a live `DropzoneCardComponent` with its own isolated store instances so several fixtures
 * on the same page can each show a different state without sharing the global `TransferStore`.
 */
@Component({
  selector: 'lib-dev-dropzone-fixture',
  imports: [DropzoneCardComponent],
  template: `<lib-dropzone-card />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    TransferStore,
    { provide: DeviceStore, useValue: { devices: signal([FIXTURE_DEVICE]) } },
    {
      provide: StorageStore,
      useValue: {
        getSelectedDirectoryForDevice: () => ({
          deviceId: FIXTURE_DEVICE_ID,
          storageType: StorageType.Sd,
          path: '/music/',
        }),
      },
    },
    { provide: TRANSFER_CONTEXT, useValue: NO_OP_TRANSFER_CONTEXT },
  ],
})
export class DevDropzoneFixtureComponent implements OnInit {
  readonly forceBusy = input(false);

  private readonly transferStore = inject(TransferStore);

  ngOnInit(): void {
    this.transferStore.setTargetDevice({ deviceId: FIXTURE_DEVICE_ID });
    if (this.forceBusy()) {
      this.transferStore.setActiveForeignJob({
        deviceId: FIXTURE_DEVICE_ID,
        activeForeignJobId: 'fixture-foreign-job',
      });
    }
  }
}
