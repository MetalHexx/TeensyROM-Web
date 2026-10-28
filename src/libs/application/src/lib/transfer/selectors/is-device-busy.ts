import { computed } from '@angular/core';
import { TransferState } from '../transfer-store';
import { WritableStore, isTerminalJobState } from '../transfer-helpers';

/**
 * True while anything holds the device: a refused create, a foreign job, this tab's own scan or
 * create, or an own job that has not ended — shown or hidden.
 */
export function isDeviceBusy(store: WritableStore<TransferState>) {
  return {
    isDeviceBusy: (deviceId: string) =>
      computed(() => {
        const transfer = store.transfers()[deviceId];
        return (
          transfer != null &&
          (transfer.phase === 'device-busy' ||
            transfer.activeForeignJobId !== null ||
            transfer.phase === 'scanning' ||
            transfer.phase === 'starting' ||
            (transfer.job !== null && !isTerminalJobState(transfer.job.state)))
        );
      }),
  };
}
