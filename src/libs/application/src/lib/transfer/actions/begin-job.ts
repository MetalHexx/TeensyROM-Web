import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { TransferState } from '../transfer-store';
import { WritableStore, updateDeviceTransferState } from '../transfer-helpers';

export interface BeginJobParams {
  deviceId: string;
}

/** Marks job creation as in flight. Also used to retry from `device-busy` — the manifest is retained. */
export function beginJob(store: WritableStore<TransferState>) {
  return {
    beginJob: ({ deviceId }: BeginJobParams): void => {
      const actionMessage = createAction('begin-job');
      logInfo(LogType.Start, `TransferAction: Beginning job creation for device ${deviceId}`);

      updateDeviceTransferState(store, deviceId, actionMessage, (state) => ({
        ...state,
        phase: 'starting',
        job: null,
        error: null,
        isLoading: true,
        lastUpdated: Date.now(),
      }));
    },
  };
}
