import { Injectable, inject } from '@angular/core';
import {
  TRANSFER_SERVICE,
  ITransferService,
  TransferDeviceBusyError,
  TransferCreateRejectedError,
  StorageType,
  TransferJobSnapshot,
  TransferManifestEntry,
} from '@teensyrom-nx/domain';
import { TransferStore } from './transfer-store';
import { DropScanner } from './drop-scanner';
import { UploadPool } from './upload-pool';
import { TransferHubListener } from './transfer-hub-listener';
import { StorageStore } from '../storage/storage-store';
import { logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { ITransferContext } from './transfer-context.interface';

/** Everything captured once at drop time and carried through to the seal, per device. */
interface PendingTransfer {
  storageType: StorageType;
  destinationDirectory: string;
  manifest: TransferManifestEntry[];
  archiveCount: number;
  scanAbort: AbortController;
  uploadAbort: AbortController;
  jobId: string | null;
  cancelled: boolean;
}

/** Minimum time a client-only transfer phase stays on screen before the next one replaces it. */
const MIN_STATE_DISPLAY_MS = 1000;

/** Resolves once `minMs` has elapsed since `startedAt`; resolves immediately if it already has. */
function holdUntil(startedAt: number, minMs: number): Promise<void> {
  const remaining = minMs - (Date.now() - startedAt);
  return remaining > 0
    ? new Promise((resolve) => setTimeout(resolve, remaining))
    : Promise.resolve();
}

/**
 * Turns a drop into a completed transfer by sequencing its collaborators: `DropScanner` walks,
 * `TransferHubListener` folds the live job, `UploadPool` drives the HTTP uploads, and
 * `ITransferService` owns job lifecycle calls. This service does none of that work itself — it
 * only orders it and retains the scanned manifest so a device-busy conflict can be retried
 * without re-scanning.
 */
@Injectable({ providedIn: 'root' })
export class TransferContextService implements ITransferContext {
  private readonly store = inject(TransferStore);
  private readonly storageStore = inject(StorageStore);
  private readonly dropScanner = inject(DropScanner);
  private readonly uploadPool = inject(UploadPool);
  private readonly hubListener = inject(TransferHubListener);
  private readonly transferService: ITransferService = inject(TRANSFER_SERVICE);

  private readonly pending = new Map<string, PendingTransfer>();

  async startTransfer(deviceId: string, input: DataTransferItemList | FileList): Promise<void> {
    const destination = this.captureDestination(deviceId);
    if (!destination) {
      logError(`TransferContextService: No destination selected for device ${deviceId}`);
      this.store.setTransferError({ deviceId, error: 'No destination selected for this device.' });
      return;
    }

    const pending: PendingTransfer = {
      storageType: destination.storageType,
      destinationDirectory: destination.path,
      manifest: [],
      archiveCount: 0,
      scanAbort: new AbortController(),
      uploadAbort: new AbortController(),
      jobId: null,
      cancelled: false,
    };
    this.pending.set(deviceId, pending);

    logInfo(LogType.Start, `TransferContextService: Starting transfer for device ${deviceId}`);

    this.store.beginScan({
      deviceId,
      droppedRootName: peekRootName(input) ?? '',
      destinationLabel: destination.path,
    });
    const scanningEnteredAt = Date.now();

    const scanResult = await this.dropScanner.scan(
      input,
      (found) => this.store.reportScanProgress({ deviceId, scanFound: found }),
      pending.scanAbort.signal
    );

    // Cancel may have already cleared this device's state while the walk was in flight.
    if (pending.cancelled) {
      return;
    }

    await holdUntil(scanningEnteredAt, MIN_STATE_DISPLAY_MS);

    // Cancel may have landed during the hold too.
    if (pending.cancelled) {
      return;
    }

    const scanTotalBytes = scanResult.entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);

    this.store.completeScan({
      deviceId,
      scanTotal: scanResult.entries.length,
      archivesSent: scanResult.archiveCount,
      scanTotalBytes,
    });

    if (scanResult.entries.length === 0) {
      logInfo(LogType.Finish, `TransferContextService: Nothing to transfer for device ${deviceId}`);
      return;
    }

    pending.manifest = scanResult.entries;
    pending.archiveCount = scanResult.archiveCount;

    await this.createAndRun(deviceId, pending);
  }

  /** Reuses the manifest retained from the original drop — never re-scans. */
  async retryCreate(deviceId: string): Promise<void> {
    const pending = this.pending.get(deviceId);
    if (!pending) {
      logError(`TransferContextService: No retained transfer to retry for device ${deviceId}`);
      return;
    }

    await this.createAndRun(deviceId, pending);
  }

  async cancelTransfer(deviceId: string): Promise<void> {
    const pending = this.pending.get(deviceId);

    if (!pending || pending.jobId === null) {
      pending?.scanAbort.abort();
      if (pending) {
        pending.cancelled = true;
      }
      this.pending.delete(deviceId);
      this.store.clearTransfer({ deviceId });
      return;
    }

    pending.cancelled = true;
    pending.uploadAbort.abort();
    try {
      const snapshot = await this.transferService.cancelJob(pending.jobId);
      this.store.applyJobSnapshot({ deviceId, snapshot });
    } catch (error) {
      logError(`TransferContextService: Failed to cancel job ${pending.jobId} for device ${deviceId}`, error);
      this.store.setCancelError({
        deviceId,
        error: error instanceof Error ? error.message : 'Failed to cancel transfer.',
      });
    }
  }

  async closeTransfer(deviceId: string): Promise<void> {
    await this.hubListener.stop();
    this.pending.delete(deviceId);
    this.store.clearTransfer({ deviceId });
  }

  async refreshDeviceBusyState(deviceId: string): Promise<void> {
    const job = await this.transferService.getActiveJob(deviceId);
    this.store.setActiveForeignJob({ deviceId, activeForeignJobId: job?.jobId ?? null });
  }

  private async createAndRun(deviceId: string, pending: PendingTransfer): Promise<void> {
    this.store.beginJob({ deviceId });
    const startingEnteredAt = Date.now();

    let snapshot: TransferJobSnapshot;
    try {
      snapshot = await this.transferService.createJob(
        deviceId,
        pending.storageType,
        pending.destinationDirectory,
        pending.archiveCount
      );
    } catch (error) {
      if (pending.cancelled) {
        return;
      }
      await holdUntil(startingEnteredAt, MIN_STATE_DISPLAY_MS);
      if (pending.cancelled) {
        return;
      }
      if (error instanceof TransferDeviceBusyError) {
        this.store.setDeviceBusy({
          deviceId,
          activeForeignJobId: error.activeJobId,
          error: error.message,
        });
        return;
      }
      if (error instanceof TransferCreateRejectedError) {
        this.store.setTransferError({ deviceId, error: error.message });
        return;
      }
      throw error;
    }

    await holdUntil(startingEnteredAt, MIN_STATE_DISPLAY_MS);

    // The create call can't be aborted mid-flight; if cancel arrived while it was in flight (or
    // during the hold above), undo it now — the cancel endpoint is idempotent even against a job
    // this fresh.
    if (pending.cancelled) {
      try {
        await this.transferService.cancelJob(snapshot.jobId);
      } catch (cancelError) {
        logError(
          `TransferContextService: Failed to cancel job ${snapshot.jobId} after local cancellation`,
          cancelError
        );
      }
      return;
    }

    pending.jobId = snapshot.jobId;

    // Subscribe before the first upload so the seed snapshot and group membership exist from the outset.
    await this.hubListener.start(deviceId, snapshot.jobId);

    await this.uploadPool.run(
      snapshot.jobId,
      pending.manifest,
      {
        onFileUploaded: (entry) => {
          logInfo(
            LogType.Info,
            `TransferContextService: Uploaded ${entry.relativePath} for device ${deviceId}`
          );
        },
        onFileFailed: (entry, reason) => {
          this.store.recordUploadFailure({ deviceId, relativePath: entry.relativePath, reason });
        },
        onBytesProgress: ({ bytesUploaded, bytesPerSecond }) => {
          this.store.reportUploadProgress({
            deviceId,
            uploadedBytes: bytesUploaded,
            uploadBytesPerSecond: bytesPerSecond,
          });
        },
      },
      pending.uploadAbort.signal
    );

    // Cancel may have aborted the upload pool while it was running; `run` resolves normally on
    // abort rather than rejecting, so the seal must be skipped explicitly.
    if (pending.cancelled) {
      return;
    }

    // Without the seal the server can't distinguish "still scanning" from "done".
    await this.transferService.sealJob(snapshot.jobId);

    logInfo(
      LogType.Finish,
      `TransferContextService: Sealed job ${snapshot.jobId} for device ${deviceId}`
    );
  }

  private captureDestination(deviceId: string): { storageType: StorageType; path: string } | null {
    const selected = this.storageStore.getSelectedDirectoryForDevice(deviceId);
    if (!selected || selected.storageType === null) {
      return null;
    }

    return { storageType: selected.storageType, path: selected.path };
  }
}

function isDataTransferItemList(
  input: DataTransferItemList | FileList
): input is DataTransferItemList {
  const first = (input as ArrayLike<{ webkitGetAsEntry?: unknown }>)[0];
  return typeof first?.webkitGetAsEntry === 'function';
}

/**
 * Reads the dropped top-level name synchronously, without walking the tree — the same value
 * `DropScanner` would eventually report, just without doing its work to get it.
 */
function peekRootName(input: DataTransferItemList | FileList): string | null {
  if (input.length === 0) {
    return null;
  }

  if (isDataTransferItemList(input)) {
    const entry = input[0].webkitGetAsEntry();
    return entry?.isDirectory ? entry.name : null;
  }

  const first = input[0];
  return first.webkitRelativePath ? first.webkitRelativePath.split('/')[0] : null;
}
