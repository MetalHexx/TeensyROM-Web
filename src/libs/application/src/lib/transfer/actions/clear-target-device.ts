import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { updateState } from '@angular-architects/ngrx-toolkit';
import { TransferState } from '../transfer-store';
import { WritableStore } from '../transfer-helpers';

export function clearTargetDevice(store: WritableStore<TransferState>) {
  return {
    clearTargetDevice: (): void => {
      logInfo(LogType.Info, 'TransferAction: Clearing target device');

      const actionMessage = createAction('clear-target-device');
      updateState(store, actionMessage, (state) => ({
        targetDeviceId: null,
        transfers: state.transfers,
      }));
    },
  };
}
