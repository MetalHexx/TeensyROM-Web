import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { updateState } from '../../with-devtools';
import { TransferJobSnapshot } from '@teensyrom-nx/domain';
import { TransferState } from '../transfer-store';
import {
  WritableStore,
  createDefaultDeviceTransferState,
  isTerminalJobState,
  PRE_JOB_PHASES,
} from '../transfer-helpers';
import { applyJobSnapshot } from './apply-job-snapshot';
import { setActiveForeignJob } from './set-active-foreign-job';

export interface FoldLiveSnapshotParams {
  snapshot: TransferJobSnapshot;
}

/**
 * The single fold point for every job snapshot, whichever subscription delivered it.
 *
 * A device runs one transfer at a time, so state is keyed by device and the entry decides what a
 * snapshot means: this tab's own transfer follows only its own job; while its own create or
 * refusal is pending, another job is merely recorded as the foreign job on the device; otherwise
 * the snapshot belongs to the entry, and a newer job replaces an ended one.
 */
export function foldLiveSnapshot(store: WritableStore<TransferState>) {
  const { applyJobSnapshot: apply } = applyJobSnapshot(store);
  const { setActiveForeignJob: recordForeignJob } = setActiveForeignJob(store);

  return {
    foldLiveSnapshot: ({ snapshot }: FoldLiveSnapshotParams): void => {
      const { deviceId } = snapshot;
      const entry = store.transfers()[deviceId];
      const currentJob = entry?.job ?? null;

      if (entry?.startedHere) {
        if (currentJob?.jobId === snapshot.jobId) {
          apply({ deviceId, snapshot });
          return;
        }
        if (entry.phase === 'starting') {
          return;
        }
        if (PRE_JOB_PHASES.has(entry.phase)) {
          if (!isTerminalJobState(snapshot.state)) {
            recordForeignJob({ deviceId, activeForeignJobId: snapshot.jobId });
          } else if (snapshot.jobId === entry.activeForeignJobId) {
            recordForeignJob({ deviceId, activeForeignJobId: null });
          }
          return;
        }
        // An own job still under way is never displaced by another job's snapshot.
        if (currentJob && !isTerminalJobState(currentJob.state)) {
          return;
        }
      }

      if (currentJob && currentJob.jobId !== snapshot.jobId) {
        // A late push of an earlier job.
        if (snapshot.startedUtc.getTime() < currentJob.startedUtc.getTime()) {
          return;
        }
      }

      if (currentJob?.jobId !== snapshot.jobId) {
        logInfo(LogType.Info, `TransferAction: Device ${deviceId} now tracks job ${snapshot.jobId}`);
        updateState(store, createAction('fold-live-snapshot'), (state) => ({
          transfers: {
            ...state.transfers,
            [deviceId]: createDefaultDeviceTransferState(deviceId),
          },
        }));
      }

      apply({ deviceId, snapshot });
    },
  };
}
