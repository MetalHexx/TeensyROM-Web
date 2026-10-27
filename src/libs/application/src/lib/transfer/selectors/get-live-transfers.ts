import { computed } from '@angular/core';
import { TransferJobState } from '@teensyrom-nx/domain';
import { DeviceTransferState, LiveTransfer, TransferState } from '../transfer-store';
import { WritableStore, computeTransferMetrics } from '../transfer-helpers';

const LIVE_JOB_STATES = new Set<TransferJobState>([
  TransferJobState.Created,
  TransferJobState.Receiving,
  TransferJobState.Sealed,
]);

/** True while the entry's job is Created, Receiving or Sealed. */
export function isLiveEntry(entry: DeviceTransferState): boolean {
  return entry.job !== null && LIVE_JOB_STATES.has(entry.job.state);
}

export function toLiveTransfer(entry: DeviceTransferState): LiveTransfer | null {
  const job = entry.job;
  if (!job || !isLiveEntry(entry)) {
    return null;
  }
  const metrics = computeTransferMetrics(entry);
  return {
    deviceId: entry.deviceId,
    jobId: job.jobId,
    origin: job.origin,
    state: job.state,
    filesSent: job.filesSent,
    filesReceived: job.filesReceived,
    totalFiles: job.totalFiles,
    fileTotal: metrics.total,
    devicePercent: metrics.devicePct,
    bytesPerSecond: job.bytesPerSecond,
    startedAt: job.startedUtc.getTime(),
    startedHere: entry.startedHere,
  };
}

/** Every transfer under way, from this tab or elsewhere, oldest first. */
export function getLiveTransfers(store: WritableStore<TransferState>) {
  return {
    getLiveTransfers: () =>
      computed<LiveTransfer[]>(() =>
        Object.values(store.transfers())
          .map(toLiveTransfer)
          .filter((live): live is LiveTransfer => live !== null)
          .sort((a, b) => a.startedAt - b.startedAt)
      ),
  };
}
