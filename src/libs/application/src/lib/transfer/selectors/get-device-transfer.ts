import { computed } from '@angular/core';
import { TransferState } from '../transfer-store';
import { WritableStore } from '../transfer-helpers';

export function getDeviceTransfer(store: WritableStore<TransferState>) {
  return {
    getDeviceTransfer: (deviceId: string) =>
      computed(() => {
        return store.transfers()[deviceId] ?? null;
      }),
  };
}
