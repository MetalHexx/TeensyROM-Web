import { computed } from '@angular/core';
import { TransferState } from '../transfer-store';
import { WritableStore } from '../transfer-helpers';

/** The device whose transfer the details dialog shows; null while the dialog is closed or hidden. */
export function getDetailsDeviceId(store: WritableStore<TransferState>) {
  return {
    getDetailsDeviceId: () => computed(() => store.detailsDeviceId()),
  };
}
