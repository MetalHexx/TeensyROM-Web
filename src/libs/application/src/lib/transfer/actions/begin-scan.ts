import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { updateState } from '@angular-architects/ngrx-toolkit';
import { DeviceTransferState, TransferState } from '../transfer-store';
import { WritableStore, createDefaultDeviceTransferState } from '../transfer-helpers';

export interface BeginScanParams {
  deviceId: string;
  droppedRootName: string;
  destinationLabel: string;
}

export function beginScan(store: WritableStore<TransferState>) {
  return {
    beginScan: ({ deviceId, droppedRootName, destinationLabel }: BeginScanParams): void => {
      logInfo(LogType.Start, `TransferAction: Beginning scan for device ${deviceId}`);

      const actionMessage = createAction('begin-scan');
      const freshTransfer: DeviceTransferState = {
        ...createDefaultDeviceTransferState(deviceId),
        phase: 'scanning',
        droppedRootName,
        destinationLabel,
        isLoading: true,
        lastUpdated: Date.now(),
      };

      updateState(store, actionMessage, (state) => ({
        transfers: {
          ...state.transfers,
          [deviceId]: freshTransfer,
        },
      }));
    },
  };
}
