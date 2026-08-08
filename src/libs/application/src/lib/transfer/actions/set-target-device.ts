import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { updateState } from '@angular-architects/ngrx-toolkit';
import { TransferState } from '../transfer-store';
import { WritableStore } from '../transfer-helpers';

export function setTargetDevice(store: WritableStore<TransferState>) {
  return {
    setTargetDevice: ({ deviceId }: { deviceId: string }): void => {
      logInfo(LogType.Info, `TransferAction: Setting target device to ${deviceId}`);

      const actionMessage = createAction('set-target-device');
      updateState(store, actionMessage, (state) => ({
        targetDeviceId: deviceId,
        transfers: state.transfers,
      }));
    },
  };
}
