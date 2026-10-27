import { computed } from '@angular/core';
import { DeviceTransferState, TransferState, TransferTab } from '../transfer-store';
import {
  WritableStore,
  computeTransferMetrics,
  isTerminalJobState,
  PRE_JOB_PHASES,
} from '../transfer-helpers';
import { isLiveEntry } from './get-live-transfers';

function hasTab(entry: DeviceTransferState, detailsDeviceId: string | null): boolean {
  return (
    isLiveEntry(entry) ||
    (entry.startedHere && (PRE_JOB_PHASES.has(entry.phase) || entry.phase === 'cancel-failed')) ||
    (entry.deviceId === detailsDeviceId && entry.phase !== 'idle')
  );
}

/**
 * The tabs of the details dialog: every live transfer, every own entry still before its job or
 * in `cancel-failed`, and the shown device's entry even once it has ended.
 */
export function getTransferTabs(store: WritableStore<TransferState>) {
  return {
    getTransferTabs: () =>
      computed<TransferTab[]>(() => {
        const detailsDeviceId = store.detailsDeviceId();
        return Object.values(store.transfers())
          .filter((entry) => hasTab(entry, detailsDeviceId))
          .sort(
            (a, b) => (a.startedAt ?? a.lastUpdated ?? 0) - (b.startedAt ?? b.lastUpdated ?? 0)
          )
          .map((entry) => ({
            deviceId: entry.deviceId,
            percent: entry.job ? computeTransferMetrics(entry).devicePct : 0,
            ended: entry.job !== null && isTerminalJobState(entry.job.state),
          }));
      }),
  };
}
