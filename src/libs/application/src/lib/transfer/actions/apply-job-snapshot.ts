import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { TransferJobSnapshot, TransferFileCompletion } from '@teensyrom-nx/domain';
import { TransferState, TransferFeedEntry } from '../transfer-store';
import {
  WritableStore,
  updateDeviceTransferState,
  toFeedFileName,
  pushFeedEntries,
} from '../transfer-helpers';

export interface ApplyJobSnapshotParams {
  deviceId: string;
  snapshot: TransferJobSnapshot;
}

function toFeedEntry(completion: TransferFileCompletion): TransferFeedEntry {
  return {
    relativePath: completion.relativePath,
    fileName: toFeedFileName(completion.relativePath),
    success: completion.success,
    reason: completion.success ? null : `device write failed — ${completion.error}`,
  };
}

/** Identifies a completion for the fold's "already seen" check — every field must match. */
function completionKey(completion: TransferFileCompletion): string {
  return JSON.stringify(completion);
}

/**
 * Folds a hub-pushed (or seed) job snapshot into the device's transfer state.
 *
 * `snapshot.recentCompletions` is not a delta - the same entries arrive again next tick if
 * nothing new completed - so only the entries absent from the *previous* snapshot's
 * `recentCompletions` (read here before `job` is overwritten) are folded into `feed`.
 * `failures` is never accumulated from the feed: it is recomputed on every snapshot from its two
 * disjoint sources, the client-only `localFailures` and the server-authoritative
 * `snapshot.failures`, so a server-side failure that has aged out of `snapshot.failures` still
 * shows up in `feed` (via `recentCompletions`) without corrupting the failure-overflow count.
 */
export function applyJobSnapshot(store: WritableStore<TransferState>) {
  return {
    applyJobSnapshot: ({ deviceId, snapshot }: ApplyJobSnapshotParams): void => {
      const actionMessage = createAction('apply-job-snapshot');
      logInfo(
        LogType.Info,
        `TransferAction: Applying job snapshot for device ${deviceId}: ${snapshot.state}`
      );

      updateDeviceTransferState(store, deviceId, actionMessage, (state) => {
        const previouslySeen = new Set((state.job?.recentCompletions ?? []).map(completionKey));
        const newFeedEntries = snapshot.recentCompletions
          .filter((completion) => !previouslySeen.has(completionKey(completion)))
          .map(toFeedEntry);
        const snapshotFailureEntries = snapshot.failures.map(toFeedEntry);

        return {
          ...state,
          ...pushFeedEntries(state, newFeedEntries, snapshotFailureEntries),
          phase: 'running',
          job: snapshot,
          error: null,
          isLoading: false,
          startedAt: snapshot.startedUtc.getTime(),
          lastUpdated: Date.now(),
        };
      });
    },
  };
}
