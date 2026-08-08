import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { TransferJobSnapshot } from '@teensyrom-nx/domain';
import { TransferState } from '../transfer-store';
import { WritableStore, updateDeviceTransferState } from '../transfer-helpers';

export interface ApplyJobSnapshotParams {
  deviceId: string;
  snapshot: TransferJobSnapshot;
}

/** Folds a hub-pushed (or seed) job snapshot into the device's transfer state. */
export function applyJobSnapshot(store: WritableStore<TransferState>) {
  return {
    applyJobSnapshot: ({ deviceId, snapshot }: ApplyJobSnapshotParams): void => {
      const actionMessage = createAction('apply-job-snapshot');
      logInfo(
        LogType.Info,
        `TransferAction: Applying job snapshot for device ${deviceId}: ${snapshot.state}`
      );

      updateDeviceTransferState(store, deviceId, actionMessage, (state) => ({
        ...state,
        phase: 'running',
        job: snapshot,
        error: null,
        isLoading: false,
        startedAt: snapshot.startedUtc.getTime(),
        lastUpdated: Date.now(),
      }));
    },
  };
}
