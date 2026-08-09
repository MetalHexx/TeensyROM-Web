import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { TransferState } from '../transfer-store';
import { WritableStore, updateDeviceTransferState } from '../transfer-helpers';

export interface SetDeviceBusyParams {
  deviceId: string;
  activeForeignJobId: string | null;
  error: string;
}

/** Records that job creation was refused as a conflict; the scan manifest is left untouched. */
export function setDeviceBusy(store: WritableStore<TransferState>) {
  return {
    setDeviceBusy: ({ deviceId, activeForeignJobId, error }: SetDeviceBusyParams): void => {
      const actionMessage = createAction('set-device-busy');
      logInfo(
        LogType.Warning,
        `TransferAction: Device ${deviceId} is busy with job ${activeForeignJobId ?? 'unknown'}`
      );

      updateDeviceTransferState(store, deviceId, actionMessage, (state) => ({
        ...state,
        phase: 'device-busy',
        activeForeignJobId,
        error,
        isLoading: false,
        lastUpdated: Date.now(),
      }));
    },
  };
}
