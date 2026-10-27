import { InjectionToken } from '@angular/core';

/**
 * Sequences a drop into a completed transfer: scan, create, subscribe, upload, seal — and holds
 * the manifest retained across a device-busy conflict so a retry never re-scans. Also steers the
 * details dialog and cancels a transfer by whoever started it.
 */
export interface ITransferContext {
  startTransfer(deviceId: string, input: DataTransferItemList | FileList): Promise<void>;
  retryCreate(deviceId: string): Promise<void>;
  cancelTransfer(deviceId: string): Promise<void>;
  closeTransfer(deviceId: string): Promise<void>;
  /** Shows a device's transfer in the dialog, first closing the previously shown one if it has ended. */
  showDetails(deviceId: string): Promise<void>;
  /** Hides the dialog, dropping the shown transfer once it has ended. Never cancels anything. */
  hideDetails(): Promise<void>;
  /** Stops a device's own job subscription and forgets its retained drop; leaves the store entry alone. */
  releaseOwnRecords(deviceId: string): Promise<void>;
}

export const TRANSFER_CONTEXT = new InjectionToken<ITransferContext>('TRANSFER_CONTEXT');
