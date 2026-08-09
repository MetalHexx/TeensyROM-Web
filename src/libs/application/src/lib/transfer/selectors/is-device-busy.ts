import { computed } from '@angular/core';
import { TransferState } from '../transfer-store';
import { WritableStore } from '../transfer-helpers';

/** True once the busy-device pre-check (or a refused create) has recorded a foreign active job. */
export function isDeviceBusy(store: WritableStore<TransferState>) {
  return {
    isDeviceBusy: (deviceId: string) =>
      computed(() => {
        const transfer = store.transfers()[deviceId];
        return transfer != null && (transfer.phase === 'device-busy' || transfer.activeForeignJobId !== null);
      }),
  };
}
