import { createAction, logError } from '@teensyrom-nx/utils';
import { TransferState } from '../transfer-store';
import { WritableStore, updateDeviceTransferState } from '../transfer-helpers';

export interface SetTransferErrorParams {
  deviceId: string;
  error: string;
}

/** Records a non-retryable create rejection. */
export function setTransferError(store: WritableStore<TransferState>) {
  return {
    setTransferError: ({ deviceId, error }: SetTransferErrorParams): void => {
      const actionMessage = createAction('set-transfer-error');
      logError(`TransferAction: Transfer error for device ${deviceId}: ${error}`);

      updateDeviceTransferState(store, deviceId, actionMessage, (state) => ({
        ...state,
        phase: 'failed',
        error,
        isLoading: false,
        lastUpdated: Date.now(),
      }));
    },
  };
}
