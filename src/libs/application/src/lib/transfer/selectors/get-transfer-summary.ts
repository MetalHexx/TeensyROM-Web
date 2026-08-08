import { computed } from '@angular/core';
import { TransferState } from '../transfer-store';
import { WritableStore, computeTransferMetrics, deriveTransferModalState } from '../transfer-helpers';

export interface TransferSummary {
  elapsedLabel: string | null; // 'mm:ss elapsed' from startedAt; null before a job exists
  failureOverflow: number; // failed - failures.length, floored at 0
  reason: string | null; // the terminal banner text
}

function formatElapsed(startedAt: number): string {
  const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} elapsed`;
}

/**
 * The three derived display values the modal needs and nothing else computes. `reason` reads
 * as a fixed client-authored banner for cancelled/aborted/abandoned, and as the create failure's
 * own message for device-busy/failed; every other modal state has no banner.
 */
export function getTransferSummary(store: WritableStore<TransferState>) {
  return {
    getTransferSummary: (deviceId: string) =>
      computed<TransferSummary>(() => {
        const transfer = store.transfers()[deviceId] ?? null;
        const metrics = computeTransferMetrics(transfer);
        const modalState = deriveTransferModalState(transfer);

        const elapsedLabel = transfer?.startedAt != null ? formatElapsed(transfer.startedAt) : null;
        const failureOverflow = Math.max(0, metrics.failed - (transfer?.failures.length ?? 0));

        let reason: string | null;
        switch (modalState) {
          case 'cancelled':
            reason = 'Transfer stopped at your request. Files already written to the device remain.';
            break;
          case 'aborted':
            reason = 'The device disconnected mid-transfer.';
            break;
          case 'abandoned':
            reason =
              'The server stopped hearing from this browser and closed the job. Files staged but not yet written were discarded.';
            break;
          case 'device-busy':
          case 'failed':
            reason = transfer?.error ?? null;
            break;
          default:
            reason = null;
        }

        return { elapsedLabel, failureOverflow, reason };
      }),
  };
}
