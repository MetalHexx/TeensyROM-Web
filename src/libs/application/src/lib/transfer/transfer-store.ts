import { signalStore, withState } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { logInfo, LogType } from '@teensyrom-nx/utils';
import { TransferJobSnapshot } from '@teensyrom-nx/domain';
import { withTransferSelectors } from './selectors';
import { withTransferActions } from './actions';

/**
 * Lifecycle phase of a single device's transfer, client-side.
 *
 * `running` is the only phase backed by a job; the modal state within it is derived from
 * `job.state` (see `getTransferModalState`). Every other phase is client-only bookkeeping
 * that exists before a job is created or after create is refused.
 */
export type TransferPhase =
  | 'idle' // no transfer for this device
  | 'scanning' // walking the dropped tree; no job exists
  | 'nothing-to-transfer' // the scan matched zero files; no job was created
  | 'starting' // creating the job
  | 'device-busy' // create refused as a conflict; the manifest is retained
  | 'failed' // create rejected for another reason; not retryable
  | 'running'; // a job exists — the displayed state comes from job.state

/** Renderable states the transfer modal can be in; `null` from a selector means the modal is closed. */
export type TransferModalState =
  | 'scanning'
  | 'starting'
  | 'device-busy'
  | 'nothing-to-transfer'
  | 'failed'
  | 'receiving'
  | 'draining'
  | 'cancelling'
  | 'completed'
  | 'cancelled'
  | 'aborted'
  | 'abandoned';

/** One entry in a device's activity feed / end-of-job failure summary. */
export interface TransferFeedEntry {
  relativePath: string;
  fileName: string;
  success: boolean;
  reason: string | null; // names which hop failed
}

export interface DeviceTransferState {
  deviceId: string;
  phase: TransferPhase;
  job: TransferJobSnapshot | null;
  scanFound: number; // ticks upward during the walk
  scanTotal: number; // the manifest size — the denominator for both bars
  uploadFailedCount: number; // files that exhausted their upload attempts locally
  feed: TransferFeedEntry[]; // capped, newest first
  failures: TransferFeedEntry[]; // capped, for the end-of-job summary
  droppedRootName: string | null;
  destinationLabel: string | null;
  startedAt: number | null;
  activeForeignJobId: string | null; // set by the busy-device pre-check
  error: string | null;
  isLoading: boolean;
  lastUpdated: number | null;
}

export interface TransferState {
  targetDeviceId: string | null;
  transfers: Record<string, DeviceTransferState>;
}

const initialState: TransferState = {
  targetDeviceId: null,
  transfers: {},
};

logInfo(LogType.Start, 'TransferStore: Initializing transfer state management store');

export const TransferStore = signalStore(
  { providedIn: 'root' },
  withDevtools('transfer'),
  withState(initialState),
  withTransferSelectors(),
  withTransferActions()
);

logInfo(LogType.Success, 'TransferStore: Transfer store configured successfully');
