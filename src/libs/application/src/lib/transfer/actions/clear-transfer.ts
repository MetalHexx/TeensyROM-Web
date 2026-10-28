import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { updateState } from '@angular-architects/ngrx-toolkit';
import { TransferState } from '../transfer-store';
import {
  WritableStore,
  createDefaultDeviceTransferState,
  findWaitingRefusalDeviceId,
} from '../transfer-helpers';

export interface ClearTransferParams {
  deviceId: string;
}

/**
 * Resets a device's transfer back to `idle`, ready for the next drop. When the dialog was
 * showing that device it moves to another own refusal still waiting, or closes.
 */
export function clearTransfer(store: WritableStore<TransferState>) {
  return {
    clearTransfer: ({ deviceId }: ClearTransferParams): void => {
      const actionMessage = createAction('clear-transfer');
      logInfo(LogType.Finish, `TransferAction: Clearing transfer state for device ${deviceId}`);

      updateState(store, actionMessage, (state) => {
        const transfers = {
          ...state.transfers,
          [deviceId]: createDefaultDeviceTransferState(deviceId),
        };
        return {
          transfers,
          detailsDeviceId:
            state.detailsDeviceId === deviceId
              ? findWaitingRefusalDeviceId(transfers, deviceId)
              : state.detailsDeviceId,
        };
      });
    },
  };
}
