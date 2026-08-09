import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { updateState } from '@angular-architects/ngrx-toolkit';
import { TransferState } from '../transfer-store';
import { WritableStore, createDefaultDeviceTransferState } from '../transfer-helpers';

export interface ClearTransferParams {
  deviceId: string;
}

/** Resets a device's transfer back to `idle`, ready for the next drop. */
export function clearTransfer(store: WritableStore<TransferState>) {
  return {
    clearTransfer: ({ deviceId }: ClearTransferParams): void => {
      const actionMessage = createAction('clear-transfer');
      logInfo(LogType.Finish, `TransferAction: Clearing transfer state for device ${deviceId}`);

      updateState(store, actionMessage, (state) => ({
        transfers: {
          ...state.transfers,
          [deviceId]: createDefaultDeviceTransferState(deviceId),
        },
      }));
    },
  };
}
