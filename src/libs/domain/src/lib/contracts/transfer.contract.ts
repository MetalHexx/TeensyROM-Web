import { InjectionToken } from '@angular/core';
import { StorageType } from '../models/storage-type.enum';
import { TransferJobSnapshot } from '../models/transfer-job-snapshot.model';

/**
 * Service contract for transfer job lifecycle operations: create, upload, seal, cancel,
 * and the active-job read used as a busy-device pre-check.
 * Implemented by the infrastructure layer against the transfer API.
 */
export interface ITransferService {
  /**
   * Creates a new transfer job for the given device/storage/destination. `expectedArchiveCount`
   * is the only thing the browser tells the server up front about the archives it's about to
   * send — it's how the API tells "no archive has arrived yet" from "no archive is coming".
   */
  createJob(
    deviceId: string,
    storageType: StorageType,
    destinationDirectory: string,
    expectedArchiveCount: number
  ): Promise<TransferJobSnapshot>;

  /** Uploads a single file's raw bytes into an open transfer job. */
  uploadFile(jobId: string, file: File, relativePath: string, signal: AbortSignal): Promise<void>;

  /** Marks a transfer job as sealed - no further files will be accepted. */
  sealJob(jobId: string): Promise<void>;

  /** Requests cancellation of a transfer job; resolves with the job's post-cancel snapshot. */
  cancelJob(jobId: string): Promise<TransferJobSnapshot>;

  /** Gets the device's currently active transfer job, or null when the device is idle. */
  getActiveJob(deviceId: string): Promise<TransferJobSnapshot | null>;
}

/** Injection token for ITransferService to enable dependency injection by interface. */
export const TRANSFER_SERVICE = new InjectionToken<ITransferService>('TRANSFER_SERVICE');

/** Create was refused because the device already holds an active transfer job (409). */
export class TransferDeviceBusyError extends Error {
  constructor(readonly activeJobId: string | null, message: string) {
    super(message);
  }
}

/** Create was rejected because the destination path was invalid (400). */
export class TransferCreateRejectedError extends Error {}

/** An upload request failed; retryable distinguishes transient failures from permanent ones. */
export class TransferUploadError extends Error {
  constructor(readonly status: number, readonly retryable: boolean, message: string) {
    super(message);
  }
}
