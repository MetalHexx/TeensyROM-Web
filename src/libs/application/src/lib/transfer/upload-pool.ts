import { Injectable, inject } from '@angular/core';
import { TRANSFER_SERVICE, ITransferService, TransferUploadError, TransferManifestEntry } from '@teensyrom-nx/domain';
import { logInfo, logError, LogType } from '@teensyrom-nx/utils';
import {
  UPLOAD_POOL_CONCURRENCY,
  UPLOAD_POOL_MAX_ATTEMPTS,
  UPLOAD_POOL_BASE_BACKOFF_MS,
  UPLOAD_PROGRESS_THROTTLE_MS,
  UPLOAD_RATE_WINDOW_MS,
  UPLOAD_RATE_MIN_DIVISOR_MS,
} from './transfer.constants';

export interface UploadPoolOptions {
  concurrency: number;
  maxAttempts: number;
  baseBackoffMs: number;
}

export interface UploadPoolCallbacks {
  onFileUploaded(entry: TransferManifestEntry): void;
  onFileFailed(entry: TransferManifestEntry, reason: string): void;
  onBytesProgress(progress: { bytesUploaded: number; bytesPerSecond: number }): void;
}

const DEFAULT_OPTIONS: UploadPoolOptions = {
  concurrency: UPLOAD_POOL_CONCURRENCY,
  maxAttempts: UPLOAD_POOL_MAX_ATTEMPTS,
  baseBackoffMs: UPLOAD_POOL_BASE_BACKOFF_MS,
};

/** A rolling-rate sample: the cumulative bytes uploaded as of a point in time. */
interface RateSample {
  atMs: number;
  bytesUploaded: number;
}

/**
 * Aggregates the pool's in-flight and completed bytes into the throttled `onBytesProgress`
 * callback the pool's caller sees.
 *
 * `bytesUploaded` = the sum of every entry that finished successfully (its full `sizeBytes`,
 * counted exactly once) plus the latest absolute figure reported for each entry still in
 * flight. `bytesPerSecond` is a rolling average: the delta between the current total and the
 * oldest sample still inside the rate window, divided by the elapsed time between them — floored
 * the way the server floors its own rate divisor so the first sliver of a window can't produce
 * an absurd figure.
 */
class UploadProgressTracker {
  private readonly inFlight = new Map<string, number>();
  private completedBytes = 0;
  private readonly samples: RateSample[] = [];
  private lastEmitAtMs: number | null = null;

  constructor(private readonly onBytesProgress: UploadPoolCallbacks['onBytesProgress']) {}

  reportInFlight(relativePath: string, bytesUploaded: number): void {
    this.inFlight.set(relativePath, bytesUploaded);
    this.emitThrottled();
  }

  /** An entry is no longer in flight (failed attempt, retry pending, or exhausted) — stop counting it. */
  clearInFlight(relativePath: string): void {
    this.inFlight.delete(relativePath);
  }

  reportCompleted(relativePath: string, sizeBytes: number): void {
    this.inFlight.delete(relativePath);
    this.completedBytes += sizeBytes;
    this.emitThrottled();
  }

  /** Forces one final emit regardless of the throttle — called once the run has finished. */
  flushFinal(): void {
    this.emit(this.totalBytes());
  }

  private totalBytes(): number {
    let sum = this.completedBytes;
    for (const bytes of this.inFlight.values()) {
      sum += bytes;
    }
    return sum;
  }

  private emitThrottled(): void {
    const now = Date.now();
    if (this.lastEmitAtMs != null && now - this.lastEmitAtMs < UPLOAD_PROGRESS_THROTTLE_MS) {
      return;
    }
    this.emit(this.totalBytes());
  }

  private emit(bytesUploaded: number): void {
    const now = Date.now();
    this.pruneSamples(now);
    const bytesPerSecond = this.computeRate(now, bytesUploaded);
    this.samples.push({ atMs: now, bytesUploaded });
    this.lastEmitAtMs = now;
    this.onBytesProgress({ bytesUploaded, bytesPerSecond });
  }

  private pruneSamples(nowMs: number): void {
    while (this.samples.length > 0 && nowMs - this.samples[0].atMs > UPLOAD_RATE_WINDOW_MS) {
      this.samples.shift();
    }
  }

  private computeRate(nowMs: number, currentBytes: number): number {
    if (this.samples.length === 0) {
      // No samples inside the window: report zero rather than the last computed value — a
      // stalled transfer must look stalled.
      return 0;
    }
    const oldest = this.samples[0];
    const elapsedSeconds = Math.max(nowMs - oldest.atMs, UPLOAD_RATE_MIN_DIVISOR_MS) / 1000;
    return (currentBytes - oldest.bytesUploaded) / elapsedSeconds;
  }
}

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

    const progress = new UploadProgressTracker(callbacks.onBytesProgress);

    const iterator = manifest[Symbol.iterator]();
    const workers = Array.from({ length: workerCount }, () =>
      this.runWorker(jobId, iterator, callbacks, signal, resolved, progress)
    );

    await Promise.all(workers);
    progress.flushFinal();

    logInfo(LogType.Finish, `UploadPool: run finished for job ${jobId}`, { aborted: signal.aborted });
  }

  private async runWorker(
    jobId: string,
    iterator: Iterator<TransferManifestEntry>,
    callbacks: UploadPoolCallbacks,
    signal: AbortSignal,
    options: UploadPoolOptions,
    progress: UploadProgressTracker
  ): Promise<void> {
    while (!signal.aborted) {
      const next = iterator.next();
      if (next.done) return;

      await this.uploadWithRetry(jobId, next.value, callbacks, signal, options, progress);
    }
  }

  private async uploadWithRetry(
    jobId: string,
    entry: TransferManifestEntry,
    callbacks: UploadPoolCallbacks,
    signal: AbortSignal,
    options: UploadPoolOptions,
    progress: UploadProgressTracker
  ): Promise<void> {
    let attemptsMade = 0;
    let lastMessage = 'unknown error';

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      if (signal.aborted) return;
      attemptsMade = attempt;

      try {
        await this.transferService.uploadFile(
          jobId,
          entry.file,
          entry.relativePath,
          signal,
          (bytesUploaded) => progress.reportInFlight(entry.relativePath, bytesUploaded)
        );
        progress.reportCompleted(entry.relativePath, entry.sizeBytes);
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

        // The failed attempt's figure no longer belongs to this entry — the next attempt starts
        // the file over from zero, so its prior contribution is dropped, not carried forward.
        progress.clearInFlight(entry.relativePath);

        logError(`UploadPool: retrying "${entry.relativePath}" after attempt ${attempt}`, {
          message: lastMessage,
        });
        await delay(options.baseBackoffMs * 2 ** (attempt - 1), signal);
      }
    }

    if (signal.aborted) return;

    progress.clearInFlight(entry.relativePath);

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
