import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { TransferState } from '../transfer-store';
import { WritableStore, updateDeviceTransferState } from '../transfer-helpers';

export interface CompleteScanParams {
  deviceId: string;
  scanTotal: number;
}

export function completeScan(store: WritableStore<TransferState>) {
  return {
    completeScan: ({ deviceId, scanTotal }: CompleteScanParams): void => {
      const actionMessage = createAction('complete-scan');
      logInfo(
        LogType.Info,
        `TransferAction: Scan complete for device ${deviceId}: ${scanTotal} files matched`
      );

      updateDeviceTransferState(store, deviceId, actionMessage, (state) => ({
        ...state,
        scanTotal,
        phase: scanTotal === 0 ? 'nothing-to-transfer' : state.phase,
        isLoading: scanTotal === 0 ? false : state.isLoading,
        lastUpdated: Date.now(),
      }));
    },
  };
}
