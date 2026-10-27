import { signalStore, withState } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { logInfo, LogType } from '@teensyrom-nx/utils';
import { TransferJobSnapshot, TransferJobState, TransferOrigin } from '@teensyrom-nx/domain';
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
  | 'cancel-failed' // the cancel request itself failed; the job may still be running
  | 'running'; // a job exists — the displayed state comes from job.state

/** Renderable states the transfer modal can be in; `null` from a selector means the modal is closed. */
export type TransferModalState =
  | 'scanning'
  | 'starting'
  | 'device-busy'
  | 'nothing-to-transfer'
  | 'failed'
  | 'cancel-failed'
  | 'receiving'
  | 'draining'
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
  // The manifest size — the denominator for both bars. An archive counts as one entry here (it's
  // one upload); the transferable total once its contents are expanded is a different number the
  // server has to help compute.
  scanTotal: number;
  archivesSent: number; // number of archive entries sent, of scanTotal
  scanTotalBytes: number; // sum of the manifest's sizeBytes — the browser-to-API byte denominator
  uploadedBytes: number; // bytes the browser has put on the wire
  uploadBytesPerSecond: number; // live while running; the lifetime average once the job is terminal
  uploadFailedCount: number; // files that exhausted their upload attempts locally
  feed: TransferFeedEntry[]; // capped, newest first
  failures: TransferFeedEntry[]; // capped, for the end-of-job summary
  localFailures: TransferFeedEntry[]; // capped, client-only source folded into `failures` on each snapshot
  droppedRootName: string | null;
  destinationLabel: string | null;
  startedAt: number | null;
  activeForeignJobId: string | null; // a job this tab did not start, recorded while this tab's own entry is pre-job
  error: string | null;
  isLoading: boolean;
  lastUpdated: number | null;
  startedHere: boolean; // true only for a transfer this tab started
}

export interface TransferState {
  targetDeviceId: string | null;
  transfers: Record<string, DeviceTransferState>;
  /** The device whose transfer the details dialog shows; null while the dialog is closed or hidden. */
  detailsDeviceId: string | null;
}

/** A transfer under way on a device, from this tab or elsewhere. */
export interface LiveTransfer {
  deviceId: string;
  jobId: string;
  origin: TransferOrigin;
  state: TransferJobState; // Created | Receiving | Sealed only
  filesSent: number;
  filesReceived: number;
  totalFiles: number | null;
  fileTotal: number; // computeTransferMetrics(entry).total
  devicePercent: number; // computeTransferMetrics(entry).devicePct
  bytesPerSecond: number;
  startedAt: number;
  startedHere: boolean;
}

/** One tab of the details dialog. */
export interface TransferTab {
  deviceId: string;
  percent: number;
  ended: boolean;
}

const initialState: TransferState = {
  targetDeviceId: null,
  transfers: {},
  detailsDeviceId: null,
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
