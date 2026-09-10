import { computed } from '@angular/core';
import { TransferState } from '../transfer-store';
import { WritableStore, TransferMetrics, computeTransferMetrics } from '../transfer-helpers';

export type { TransferMetrics };

/** Returns the transfer figures — upload/device progress plus the archive-expansion arithmetic. */
export function getTransferMetrics(store: WritableStore<TransferState>) {
  return {
    getTransferMetrics: (deviceId: string) =>
      computed<TransferMetrics>(() => computeTransferMetrics(store.transfers()[deviceId] ?? null)),
  };
}
