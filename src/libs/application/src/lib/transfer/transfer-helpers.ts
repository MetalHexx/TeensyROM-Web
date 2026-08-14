import { StateSignals, WritableStateSource } from '@ngrx/signals';
import { updateState } from '@angular-architects/ngrx-toolkit';
import { logInfo, LogType } from '@teensyrom-nx/utils';
import { TransferJobState } from '@teensyrom-nx/domain';
import {
  TransferState,
  DeviceTransferState,
  TransferFeedEntry,
  TransferModalState,
} from './transfer-store';
import { TRANSFER_FEED_CAP, TRANSFER_FAILURE_CAP } from './transfer.constants';

export type WritableStore<T extends object> = StateSignals<T> & WritableStateSource<T>;

export function createDefaultDeviceTransferState(deviceId: string): DeviceTransferState {
  return {
    deviceId,
    phase: 'idle',
    job: null,
    scanFound: 0,
    scanTotal: 0,
    uploadFailedCount: 0,
    feed: [],
    failures: [],
    localFailures: [],
    droppedRootName: null,
    destinationLabel: null,
    startedAt: null,
    activeForeignJobId: null,
    error: null,
    isLoading: false,
    lastUpdated: null,
  };
}

/** Returns the device's transfer state, creating and storing a fresh `idle` entry if absent. */
export function ensureDeviceTransferState(
  store: WritableStore<TransferState>,
  deviceId: string,
  actionMessage: string
): DeviceTransferState {
  const existing = store.transfers()[deviceId];
  if (existing) {
    return existing;
  }

  logInfo(LogType.Start, `TransferHelper: Creating new transfer state for device ${deviceId}`);

  const defaultState = createDefaultDeviceTransferState(deviceId);
  updateState(store, actionMessage, (state) => ({
    transfers: {
      ...state.transfers,
      [deviceId]: defaultState,
    },
  }));

  return defaultState;
}

/** Ensures a device entry exists, then applies `updater` to it under the same action message. */
export function updateDeviceTransferState(
  store: WritableStore<TransferState>,
  deviceId: string,
  actionMessage: string,
  updater: (state: DeviceTransferState) => DeviceTransferState
): void {
  ensureDeviceTransferState(store, deviceId, actionMessage);

  updateState(store, actionMessage, (state) => {
    const current = state.transfers[deviceId];
    if (!current) {
      return state;
    }

    return {
      transfers: {
        ...state.transfers,
        [deviceId]: updater(current),
      },
    };
  });
}

export function toFeedFileName(relativePath: string): string {
  const segments = relativePath.split('/');
  return segments[segments.length - 1] || relativePath;
}

function capList<T>(list: T[], cap: number): T[] {
  return list.length > cap ? list.slice(0, cap) : list;
}

/** Prepends a feed entry (newest first) and, when it's a failure, the local failures list too — both capped. */
export function pushFeedEntry(
  state: DeviceTransferState,
  entry: TransferFeedEntry
): Pick<DeviceTransferState, 'feed' | 'localFailures'> {
  return {
    feed: capList([entry, ...state.feed], TRANSFER_FEED_CAP),
    localFailures: entry.success
      ? state.localFailures
      : capList([entry, ...state.localFailures], TRANSFER_FAILURE_CAP),
  };
}

/**
 * List-shaped counterpart to `pushFeedEntry`, for the job-snapshot fold: prepends a batch of
 * newly-arrived feed entries (already deduped against the previous snapshot, newest first) ahead
 * of the existing feed, and recomputes `failures` from its two disjoint sources — the client-only
 * `localFailures` and the server's own failure list — rather than accumulating it. Both capped.
 */
export function pushFeedEntries(
  state: DeviceTransferState,
  newFeedEntries: TransferFeedEntry[],
  snapshotFailures: TransferFeedEntry[]
): Pick<DeviceTransferState, 'feed' | 'failures'> {
  return {
    feed: capList([...newFeedEntries, ...state.feed], TRANSFER_FEED_CAP),
    failures: capList([...state.localFailures, ...snapshotFailures], TRANSFER_FAILURE_CAP),
  };
}

const TERMINAL_JOB_STATES = new Set<TransferJobState>([
  TransferJobState.Completed,
  TransferJobState.Cancelled,
  TransferJobState.Aborted,
  TransferJobState.Abandoned,
]);

/** True once the API side can no longer accept uploads — pins `apiPct` to 100. */
export function isSealedOrTerminalJobState(state: TransferJobState): boolean {
  return state === TransferJobState.Sealed || TERMINAL_JOB_STATES.has(state);
}

/** True once the job has reached one of the four terminal states — `Sealed` is not included. */
export function isTerminalJobState(state: TransferJobState): boolean {
  return TERMINAL_JOB_STATES.has(state);
}

export interface TransferMetrics {
  uploaded: number;
  written: number;
  failed: number;
  apiPct: number;
  devicePct: number;
}

// Floored and capped below 100: at scale, rounding the last fraction of a percent up reads as
// "done" while work is still outstanding. 100 is reserved for the state-driven pins below, which
// mark genuine completion — never for the ratio hitting its ceiling on its own.
function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Math.min(99, Math.floor((numerator / denominator) * 100));
}

/**
 * Single source of truth for the transfer metric arithmetic — every consumer (the metrics
 * selector, the summary selector's failure overflow) reads the figures from here. Two seams
 * matter: `apiPct` pins to 100 once the job is `Sealed` or terminal, because locally-exhausted
 * uploads never reach `filesReceived` and the ratio could otherwise never close. `devicePct`
 * pins to 100 only on `Completed` — an early stop (`Cancelled`, `Aborted`, `Abandoned`) or a
 * merely `Sealed` upload hop reports its true, sub-100 ratio.
 */
export function computeTransferMetrics(transfer: DeviceTransferState | null): TransferMetrics {
  const job = transfer?.job ?? null;
  const uploadFailedCount = transfer?.uploadFailedCount ?? 0;
  const scanTotal = transfer?.scanTotal ?? 0;

  if (!job) {
    return {
      uploaded: 0,
      written: 0,
      failed: uploadFailedCount,
      apiPct: 0,
      devicePct: 0,
    };
  }

  return {
    uploaded: job.filesReceived,
    written: job.filesSent,
    failed: job.filesFailed + uploadFailedCount,
    apiPct: isSealedOrTerminalJobState(job.state) ? 100 : pct(job.filesReceived, scanTotal),
    devicePct: job.state === TransferJobState.Completed ? 100 : pct(job.filesSent, scanTotal),
  };
}

/**
 * Maps a device's transfer state to the modal state the UI renders — the single seam where
 * the client-only phases and the server's job states meet. `idle` (or no entry) is the only
 * input that yields `null`, which is how `isTransferModalOpen` knows to close the modal.
 */
export function deriveTransferModalState(
  transfer: DeviceTransferState | null
): TransferModalState | null {
  if (!transfer || transfer.phase === 'idle') {
    return null;
  }

  if (transfer.phase !== 'running') {
    return transfer.phase;
  }

  const job = transfer.job;
  if (!job) {
    return null;
  }

  switch (job.state) {
    case TransferJobState.Created:
    case TransferJobState.Receiving:
      return 'receiving';
    case TransferJobState.Sealed:
      return 'draining';
    case TransferJobState.Cancelling:
      return 'cancelling';
    case TransferJobState.Completed:
      return 'completed';
    case TransferJobState.Cancelled:
      return 'cancelled';
    case TransferJobState.Aborted:
      return 'aborted';
    case TransferJobState.Abandoned:
      return 'abandoned';
    default:
      return null;
  }
}
