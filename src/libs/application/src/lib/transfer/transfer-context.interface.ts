import { InjectionToken } from '@angular/core';

/**
 * Sequences a drop into a completed transfer: scan, create, subscribe, upload, seal — and holds
 * the manifest retained across a device-busy conflict so a retry never re-scans.
 */
export interface ITransferContext {
  startTransfer(deviceId: string, input: DataTransferItemList | FileList): Promise<void>;
  retryCreate(deviceId: string): Promise<void>;
  cancelTransfer(deviceId: string): Promise<void>;
  closeTransfer(deviceId: string): Promise<void>;
  refreshDeviceBusyState(deviceId: string): Promise<void>;
}

export const TRANSFER_CONTEXT = new InjectionToken<ITransferContext>('TRANSFER_CONTEXT');
