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
import { DeviceTransferState, TransferStore } from './transfer-store';
import { isTerminalJobState } from './transfer-helpers';
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
 * `TransferHubListener` holds this tab's own job subscriptions, `UploadPool` drives the HTTP uploads, and
 * `ITransferService` owns job lifecycle calls. This service does none of that work itself — it
 * only orders it and retains the scanned manifest so a device-busy conflict can be retried
 * without re-scanning. It also steers the details dialog and cancels a transfer by whoever
 * started it.
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
      this.surfaceOutcome(deviceId);
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
      this.surfaceOutcome(deviceId);
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

  /**
   * Cancels the transfer on a device. This tab's own scan, create or upload takes the local path
   * (abort, then cancel the job); a transfer started elsewhere is cancelled by its job id. A
   * retained record left over from an earlier own job never redirects the cancel to that job.
   */
  async cancelTransfer(deviceId: string): Promise<void> {
    const pending = this.pending.get(deviceId);
    const job = this.store.transfers()[deviceId]?.job ?? null;

    if (pending && pending.jobId === null) {
      this.discardLocally(deviceId, pending);
      return;
    }

    if (pending && pending.jobId === job?.jobId) {
      await this.cancelOwnJob(deviceId, pending, pending.jobId);
      return;
    }

    if (job && !isTerminalJobState(job.state)) {
      await this.cancelForeignJob(deviceId, job.jobId);
      return;
    }

    this.discardLocally(deviceId, pending);
  }

  async closeTransfer(deviceId: string): Promise<void> {
    await this.releaseOwnRecords(deviceId);
    this.store.clearTransfer({ deviceId });
  }

  async releaseOwnRecords(deviceId: string): Promise<void> {
    await this.hubListener.stop(deviceId);
    this.pending.delete(deviceId);
  }

  async showDetails(deviceId: string): Promise<void> {
    const shownDeviceId = this.store.detailsDeviceId();
    if (shownDeviceId !== null && shownDeviceId !== deviceId) {
      await this.closeShownIfEnded();
    }
    this.store.showTransferDetails({ deviceId });
  }

  /**
   * Dropping an ended shown entry already settles where the details go, to another waiting own
   * refusal or nowhere, so only a transfer that stays is hidden explicitly.
   */
  async hideDetails(): Promise<void> {
    if (!(await this.closeShownIfEnded())) {
      this.store.hideTransferDetails();
    }
  }

  private discardLocally(deviceId: string, pending: PendingTransfer | undefined): void {
    if (pending) {
      pending.scanAbort.abort();
      pending.cancelled = true;
    }
    this.pending.delete(deviceId);
    this.store.clearTransfer({ deviceId });
  }

  private async cancelOwnJob(
    deviceId: string,
    pending: PendingTransfer,
    jobId: string
  ): Promise<void> {
    pending.cancelled = true;
    pending.uploadAbort.abort();
    try {
      const snapshot = await this.transferService.cancelJob(jobId);
      this.store.applyJobSnapshot({ deviceId, snapshot });
    } catch (error) {
      this.recordCancelFailure(deviceId, jobId, error);
    }
  }

  private async cancelForeignJob(deviceId: string, jobId: string): Promise<void> {
    try {
      const snapshot = await this.transferService.cancelJob(jobId);
      this.store.foldLiveSnapshot({ snapshot });
    } catch (error) {
      this.recordCancelFailure(deviceId, jobId, error);
    }
  }

  private recordCancelFailure(deviceId: string, jobId: string, error: unknown): void {
    logError(`TransferContextService: Failed to cancel job ${jobId} for device ${deviceId}`, error);
    this.store.setCancelError({
      deviceId,
      error: error instanceof Error ? error.message : 'Failed to cancel transfer.',
    });
  }

  /**
   * Drops the shown entry once it has ended: an own one through `closeTransfer`, a foreign one
   * directly. Reports whether it dropped one.
   */
  private async closeShownIfEnded(): Promise<boolean> {
    const shownDeviceId = this.store.detailsDeviceId();
    const entry = shownDeviceId === null ? undefined : this.store.transfers()[shownDeviceId];
    if (!entry || !hasEnded(entry)) {
      return false;
    }

    if (entry.startedHere) {
      await this.closeTransfer(entry.deviceId);
    } else {
      this.store.clearTransfer({ deviceId: entry.deviceId });
    }
    return true;
  }

  /**
   * Makes sure an own refusal or empty result is visible: with the dialog hidden it would have no
   * tab to show it, and a refused device stays busy until it is dismissed.
   */
  private surfaceOutcome(deviceId: string): void {
    if (this.store.detailsDeviceId() === null) {
      this.store.showTransferDetails({ deviceId });
    }
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
        this.surfaceOutcome(deviceId);
        return;
      }
      if (error instanceof TransferCreateRejectedError) {
        this.store.setTransferError({ deviceId, error: error.message });
        this.surfaceOutcome(deviceId);
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

    // The entry only follows a job whose id it knows; until now `starting` ignored every push.
    this.store.applyJobSnapshot({ deviceId, snapshot });

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

/** A terminal job, a refusal or empty result, or a failed cancel whose job has since finished. */
function hasEnded(entry: DeviceTransferState): boolean {
  if (entry.job !== null && isTerminalJobState(entry.job.state)) {
    return true;
  }
  return (
    entry.phase === 'nothing-to-transfer' || entry.phase === 'failed' || entry.phase === 'device-busy'
  );
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
