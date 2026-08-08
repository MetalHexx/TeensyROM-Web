import { computed } from '@angular/core';
import { TransferState } from '../transfer-store';
import { WritableStore } from '../transfer-helpers';

export function getTargetDeviceId(store: WritableStore<TransferState>) {
  return {
    getTargetDeviceId: () =>
      computed(() => {
        return store.targetDeviceId();
      }),
  };
}
