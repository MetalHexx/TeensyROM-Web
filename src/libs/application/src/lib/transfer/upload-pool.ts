import { Injectable, inject } from '@angular/core';
import { TRANSFER_SERVICE, ITransferService, TransferUploadError, TransferManifestEntry } from '@teensyrom-nx/domain';
import { logInfo, logError, LogType } from '@teensyrom-nx/utils';
import {
  UPLOAD_POOL_CONCURRENCY,
  UPLOAD_POOL_MAX_ATTEMPTS,
  UPLOAD_POOL_BASE_BACKOFF_MS,
} from './transfer.constants';

export interface UploadPoolOptions {
  concurrency: number;
  maxAttempts: number;
  baseBackoffMs: number;
}

export interface UploadPoolCallbacks {
  onFileUploaded(entry: TransferManifestEntry): void;
  onFileFailed(entry: TransferManifestEntry, reason: string): void;
}

const DEFAULT_OPTIONS: UploadPoolOptions = {
  concurrency: UPLOAD_POOL_CONCURRENCY,
  maxAttempts: UPLOAD_POOL_MAX_ATTEMPTS,
  baseBackoffMs: UPLOAD_POOL_BASE_BACKOFF_MS,
};

/**
 * Drives a manifest into HTTP uploads at a fixed concurrency, with retry, abort, and
 * continue-on-failure.
 *
 * The manifest is consumed lazily: a single iterator is shared by `concurrency` workers, each
 * pulling `next()` until exhausted. Nothing is ever materialized into an array or a batch of
 * promises up front.
 */
@Injectable({ providedIn: 'root' })
export class UploadPool {
  private readonly transferService: ITransferService = inject(TRANSFER_SERVICE);

  async run(
    jobId: string,
    manifest: Iterable<TransferManifestEntry>,
    callbacks: UploadPoolCallbacks,
    signal: AbortSignal,
    options?: Partial<UploadPoolOptions>
  ): Promise<void> {
    const resolved: UploadPoolOptions = { ...DEFAULT_OPTIONS, ...options };
    const workerCount = Math.max(1, resolved.concurrency);

    logInfo(LogType.Start, `UploadPool: starting run for job ${jobId}`, {
      concurrency: workerCount,
      maxAttempts: resolved.maxAttempts,
    });

    const iterator = manifest[Symbol.iterator]();
    const workers = Array.from({ length: workerCount }, () =>
      this.runWorker(jobId, iterator, callbacks, signal, resolved)
    );

    await Promise.all(workers);

    logInfo(LogType.Finish, `UploadPool: run finished for job ${jobId}`, { aborted: signal.aborted });
  }

  private async runWorker(
    jobId: string,
    iterator: Iterator<TransferManifestEntry>,
    callbacks: UploadPoolCallbacks,
    signal: AbortSignal,
    options: UploadPoolOptions
  ): Promise<void> {
    while (!signal.aborted) {
      const next = iterator.next();
      if (next.done) return;

      await this.uploadWithRetry(jobId, next.value, callbacks, signal, options);
    }
  }

  private async uploadWithRetry(
    jobId: string,
    entry: TransferManifestEntry,
    callbacks: UploadPoolCallbacks,
    signal: AbortSignal,
    options: UploadPoolOptions
  ): Promise<void> {
    let attemptsMade = 0;
    let lastMessage = 'unknown error';

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      if (signal.aborted) return;
      attemptsMade = attempt;

      try {
        await this.transferService.uploadFile(jobId, entry.file, entry.relativePath, signal);
        callbacks.onFileUploaded(entry);
        return;
      } catch (error) {
        if (signal.aborted) return;

        lastMessage = error instanceof Error ? error.message : String(error);
        // The seam that bites: a 4xx must not be retried - it will not succeed on a second try.
        const retryable = error instanceof TransferUploadError ? error.retryable : true;

        if (!retryable || attempt === options.maxAttempts) {
          break;
        }

        logError(`UploadPool: retrying "${entry.relativePath}" after attempt ${attempt}`, {
          message: lastMessage,
        });
        await delay(options.baseBackoffMs * 2 ** (attempt - 1), signal);
      }
    }

    if (signal.aborted) return;

    const reason = `upload failed after ${attemptsMade} attempts — ${lastMessage}`;
    logError(`UploadPool: exhausted attempts for "${entry.relativePath}"`, { reason });
    callbacks.onFileFailed(entry, reason);
  }
}

/** Resolves after `ms` or immediately on abort, whichever comes first - never rejects. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
