import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TRANSFER_SERVICE, ITransferService, TransferUploadError, TransferManifestEntry } from '@teensyrom-nx/domain';
import { UploadPool, UploadPoolCallbacks } from './upload-pool';

function createEntry(relativePath: string): TransferManifestEntry {
  return { file: new File(['x'], relativePath), relativePath, sizeBytes: 1 };
}

function createCallbacks(): UploadPoolCallbacks & {
  uploaded: TransferManifestEntry[];
  failed: Array<{ entry: TransferManifestEntry; reason: string }>;
} {
  const uploaded: TransferManifestEntry[] = [];
  const failed: Array<{ entry: TransferManifestEntry; reason: string }> = [];
  return {
    uploaded,
    failed,
    onFileUploaded: (entry) => uploaded.push(entry),
    onFileFailed: (entry, reason) => failed.push({ entry, reason }),
  };
}

/** Lets pending microtasks (but no timers) settle. */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function setupPool(uploadFile: ITransferService['uploadFile']): UploadPool {
  const transferService: Partial<ITransferService> = { uploadFile };
  TestBed.configureTestingModule({
    providers: [UploadPool, { provide: TRANSFER_SERVICE, useValue: transferService }],
  });
  return TestBed.inject(UploadPool);
}

describe('UploadPool', () => {
  describe('concurrency', () => {
    it('never holds more uploads in flight than configured', async () => {
      const concurrency = 3;
      const total = 9;
      let inFlight = 0;
      let peak = 0;
      const resolvers: Array<() => void> = [];

      const uploadFile = vi.fn(() => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        return new Promise<void>((resolve) => {
          resolvers.push(() => {
            inFlight--;
            resolve();
          });
        });
      });

      const pool = setupPool(uploadFile);
      const entries = Array.from({ length: total }, (_, i) => createEntry(`f${i}.sid`));
      const callbacks = createCallbacks();
      const signal = new AbortController().signal;

      const runPromise = pool.run('job-1', entries, callbacks, signal, {
        concurrency,
        maxAttempts: 1,
        baseBackoffMs: 0,
      });

      await flushMicrotasks();
      expect(peak).toBe(concurrency);

      while (callbacks.uploaded.length < total) {
        const resolve = resolvers.shift();
        if (!resolve) {
          await flushMicrotasks();
          continue;
        }
        resolve();
        await flushMicrotasks();
      }

      await runPromise;
      expect(peak).toBeLessThanOrEqual(concurrency);
      expect(callbacks.uploaded).toHaveLength(total);
    });
  });

  describe('lazy iteration', () => {
    it('never pulls more entries than the configured concurrency while uploads are pending', async () => {
      let pulls = 0;
      function* infiniteManifest(): Generator<TransferManifestEntry> {
        let i = 0;
        for (;;) {
          pulls++;
          yield createEntry(`f${i++}.sid`);
        }
      }

      const uploadFile = vi.fn(() => new Promise<void>(() => undefined));
      const pool = setupPool(uploadFile);
      const callbacks = createCallbacks();
      const signal = new AbortController().signal;

      void pool.run('job-1', infiniteManifest(), callbacks, signal, {
        concurrency: 4,
        maxAttempts: 1,
        baseBackoffMs: 0,
      });

      await flushMicrotasks();
      expect(pulls).toBe(4);
    });
  });

  describe('retry policy', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('retries a transient failure and eventually succeeds', async () => {
      let calls = 0;
      const uploadFile = vi.fn(() => {
        calls++;
        if (calls === 1) {
          return Promise.reject(new TransferUploadError(0, true, 'transport error'));
        }
        return Promise.resolve();
      });

      const pool = setupPool(uploadFile);
      const callbacks = createCallbacks();
      const signal = new AbortController().signal;

      const runPromise = pool.run('job-1', [createEntry('a.sid')], callbacks, signal, {
        concurrency: 1,
        maxAttempts: 3,
        baseBackoffMs: 10,
      });

      await vi.advanceTimersByTimeAsync(10);
      await runPromise;

      expect(uploadFile).toHaveBeenCalledTimes(2);
      expect(callbacks.uploaded).toHaveLength(1);
      expect(callbacks.failed).toHaveLength(0);
    });

    it('does not retry a 4xx failure', async () => {
      const uploadFile = vi.fn(() =>
        Promise.reject(new TransferUploadError(404, false, 'path not found'))
      );

      const pool = setupPool(uploadFile);
      const callbacks = createCallbacks();
      const signal = new AbortController().signal;

      await pool.run('job-1', [createEntry('a.sid')], callbacks, signal, {
        concurrency: 1,
        maxAttempts: 3,
        baseBackoffMs: 10,
      });

      expect(uploadFile).toHaveBeenCalledTimes(1);
      expect(callbacks.failed).toHaveLength(1);
      expect(callbacks.failed[0].reason).toBe('upload failed after 1 attempts — path not found');
    });

    it('records an exhausted file and keeps the run going', async () => {
      const uploadFile = vi.fn((jobId: string, file: File) => {
        if (file.name === 'always-fails.sid') {
          return Promise.reject(new TransferUploadError(0, true, 'transport error'));
        }
        return Promise.resolve();
      });

      const pool = setupPool(uploadFile as unknown as ITransferService['uploadFile']);
      const callbacks = createCallbacks();
      const signal = new AbortController().signal;

      const runPromise = pool.run(
        'job-1',
        [createEntry('always-fails.sid'), createEntry('ok.sid')],
        callbacks,
        signal,
        { concurrency: 1, maxAttempts: 3, baseBackoffMs: 10 }
      );

      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(20);
      await runPromise;

      expect(callbacks.failed).toHaveLength(1);
      expect(callbacks.failed[0].reason).toBe('upload failed after 3 attempts — transport error');
      expect(callbacks.uploaded).toHaveLength(1);
      expect(callbacks.uploaded[0].relativePath).toBe('ok.sid');
    });
  });

  describe('abort', () => {
    it('stops in-flight work and resolves rather than rejecting', async () => {
      const controller = new AbortController();
      const uploadFile = vi.fn(
        (_jobId: string, _file: File, _relativePath: string, signal: AbortSignal) =>
          new Promise<void>((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          })
      );

      const pool = setupPool(uploadFile as unknown as ITransferService['uploadFile']);
      const callbacks = createCallbacks();
      const entries = Array.from({ length: 5 }, (_, i) => createEntry(`f${i}.sid`));

      const runPromise = pool.run('job-1', entries, callbacks, controller.signal, {
        concurrency: 2,
        maxAttempts: 3,
        baseBackoffMs: 10,
      });

      await flushMicrotasks();
      controller.abort();

      await expect(runPromise).resolves.toBeUndefined();
      expect(callbacks.uploaded).toHaveLength(0);
      expect(callbacks.failed).toHaveLength(0);
      expect(uploadFile).toHaveBeenCalledTimes(2);
    });
  });
});
