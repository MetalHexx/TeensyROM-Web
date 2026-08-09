import { computed } from '@angular/core';
import { TransferState } from '../transfer-store';
import { WritableStore, deriveTransferModalState } from '../transfer-helpers';

export function isTransferModalOpen(store: WritableStore<TransferState>) {
  return {
    isTransferModalOpen: (deviceId: string) =>
      computed(() => deriveTransferModalState(store.transfers()[deviceId] ?? null) !== null),
  };
}
