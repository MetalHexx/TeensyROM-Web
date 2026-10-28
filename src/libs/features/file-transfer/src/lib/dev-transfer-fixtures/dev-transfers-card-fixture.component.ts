import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { DeviceStore, TransferStore, TRANSFER_CONTEXT, ITransferContext } from '@teensyrom-nx/application';
import {
  Device,
  DeviceState,
  DeviceMachine,
  DeviceVideoStandard,
  DeviceHardwareVariant,
  StorageType,
  TransferJobSnapshot,
  TransferJobState,
  TransferLaunchState,
  TransferOriginKind,
} from '@teensyrom-nx/domain';
import { TransfersCardComponent } from '../file-transfer-view/transfers-card/transfers-card.component';

function fixtureDevice(deviceId: string, name: string): Device {
  return {
    deviceId,
    comPort: 'COM3',
    name,
    fwVersion: '1.0.0',
    machine: DeviceMachine.C64,
    videoStandard: DeviceVideoStandard.Ntsc,
    todClockHz: null,
    hardwareVariant: DeviceHardwareVariant.TeensyRom,
    isCompatible: true,
    isConnected: true,
    deviceState: DeviceState.Connected,
    isEnabled: true,
    sdStorage: { deviceId, type: StorageType.Sd, available: true, indexExists: true },
    usbStorage: { deviceId, type: StorageType.Usb, available: false, indexExists: false },
  };
}

const FIXTURE_DEVICES = [fixtureDevice('fixture-tr-1', 'TR-1'), fixtureDevice('fixture-tr-2', 'Workbench TR')];

const NO_OP_TRANSFER_CONTEXT: ITransferContext = {
  startTransfer: async () => undefined,
  retryCreate: async () => undefined,
  cancelTransfer: async () => undefined,
  closeTransfer: async () => undefined,
  showDetails: async () => undefined,
  hideDetails: async () => undefined,
  releaseOwnRecords: async () => undefined,
};

function snapshot(overrides: Partial<TransferJobSnapshot>): TransferJobSnapshot {
  return {
    jobId: 'fixture-job',
    deviceId: FIXTURE_DEVICES[0].deviceId,
    storageType: StorageType.Sd,
    destinationDirectory: '/auto-transfer/',
    state: TransferJobState.Receiving,
    filesReceived: 8,
    filesSent: 8,
    filesFailed: 0,
    bytesSent: 0,
    totalFiles: 12,
    currentFile: null,
    origin: { kind: TransferOriginKind.Upload, watchFolderId: null, watchFolderPath: null },
    startedUtc: new Date(Date.now() - 42_000),
    lastActivityUtc: new Date(),
    error: null,
    failures: [],
    recentCompletions: [],
    bytesPerSecond: 412 * 1024,
    filesPerSecond: 0,
    expandingArchive: null,
    expansionBytesWritten: 0,
    expansionBytesDeclared: 0,
    expandedFileCount: null,
    launchState: TransferLaunchState.None,
    launchedPath: null,
    launchError: null,
    ...overrides,
  };
}

/**
 * Wraps a live `TransfersCardComponent` with its own isolated store so several fixtures on the
 * same page each show a different number of rows without sharing the global `TransferStore`.
 */
@Component({
  selector: 'lib-dev-transfers-card-fixture',
  imports: [TransfersCardComponent],
  template: `<lib-transfers-card />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    TransferStore,
    { provide: DeviceStore, useValue: { devices: signal(FIXTURE_DEVICES) } },
    { provide: TRANSFER_CONTEXT, useValue: NO_OP_TRANSFER_CONTEXT },
  ],
})
export class DevTransfersCardFixtureComponent implements OnInit {
  /** How many rows to seed: 0 shows the empty state; 1 a watched folder; 2 adds an upload. */
  readonly rowCount = input<0 | 1 | 2>(0);

  private readonly transferStore = inject(TransferStore);

  ngOnInit(): void {
    const [first, second] = FIXTURE_DEVICES;
    if (this.rowCount() >= 1) {
      this.transferStore.foldLiveSnapshot({
        snapshot: snapshot({
          jobId: 'fixture-job-1',
          deviceId: first.deviceId,
          origin: {
            kind: TransferOriginKind.WatchFolder,
            watchFolderId: 'fixture-watch',
            watchFolderPath: 'C:\\Users\\me\\Downloads',
          },
        }),
      });
    }
    if (this.rowCount() >= 2) {
      this.transferStore.foldLiveSnapshot({
        snapshot: snapshot({
          jobId: 'fixture-job-2',
          deviceId: second.deviceId,
          filesReceived: 1,
          filesSent: 1,
          totalFiles: 3,
          bytesPerSecond: 96 * 1024,
          startedUtc: new Date(Date.now() - 7_000),
        }),
      });
    }
  }
}
