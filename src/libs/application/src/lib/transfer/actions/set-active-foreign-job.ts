import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { TransferState } from '../transfer-store';
import { WritableStore, updateDeviceTransferState } from '../transfer-helpers';

export interface SetActiveForeignJobParams {
  deviceId: string;
  activeForeignJobId: string | null;
}

/** Records the result of the busy-device pre-check, independent of the transfer's own phase. */
export function setActiveForeignJob(store: WritableStore<TransferState>) {
  return {
    setActiveForeignJob: ({ deviceId, activeForeignJobId }: SetActiveForeignJobParams): void => {
      const actionMessage = createAction('set-active-foreign-job');
      logInfo(
        LogType.Info,
        `TransferAction: Active foreign job for device ${deviceId}: ${activeForeignJobId ?? 'none'}`
      );

      updateDeviceTransferState(store, deviceId, actionMessage, (state) => ({
        ...state,
        activeForeignJobId,
        lastUpdated: Date.now(),
      }));
    },
  };
}
