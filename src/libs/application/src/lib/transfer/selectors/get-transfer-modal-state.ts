import { computed, Signal } from '@angular/core';
import { TransferState, TransferModalState } from '../transfer-store';
import { WritableStore, deriveTransferModalState } from '../transfer-helpers';

/**
 * Derives the modal state for a device's transfer — `idle` is the only phase that yields
 * `null`, closing the modal. Every other phase maps to a renderable modal state.
 */
export function getTransferModalState(store: WritableStore<TransferState>) {
  return {
    getTransferModalState: (deviceId: string): Signal<TransferModalState | null> =>
      computed(() => deriveTransferModalState(store.transfers()[deviceId] ?? null)),
  };
}
