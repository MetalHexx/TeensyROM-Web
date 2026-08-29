import type { AnalysisScanner, ScanMessage, ScanRequest, ScanResult } from './scan-runner';

interface PendingScan {
  readonly resolve: (result: ScanResult) => void;
  readonly onProgress?: (frame: number) => void;
}

/**
 * The real scanner: a dedicated worker thread that keeps a whole-tune scan off the main one, so a
 * long scan can never sit in front of a scrub.
 *
 * The worker is built on first use rather than in the constructor — a session that never scans never
 * pays for it — and every response is matched back to its request by `id`.
 */
export class WorkerAnalysisScanner implements AnalysisScanner {
  private worker: Worker | null = null;
  private readonly pending = new Map<number, PendingScan>();

  scan(request: ScanRequest, onProgress?: (frame: number) => void): Promise<ScanResult> {
    const worker = this.ensureWorker();
    return new Promise<ScanResult>((resolve) => {
      this.pending.set(request.id, { resolve, onProgress });
      worker.postMessage(request);
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }

  private ensureWorker(): Worker {
    const existing = this.worker;
    if (existing !== null) {
      return existing;
    }

    const worker = new Worker(new URL('./scan.worker', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<ScanMessage>): void => {
      const message = event.data;
      const entry = this.pending.get(message.id);
      if (entry === undefined) {
        return;
      }
      if (message.kind === 'progress') {
        entry.onProgress?.(message.frame);
        return;
      }
      this.pending.delete(message.id);
      entry.resolve(message);
    };
    // A worker that dies takes every promise waiting on it with it, which would leave the caller
    // holding an outstanding scan id forever and silently drop every scan after it.
    worker.onerror = (): void => {
      for (const [id, entry] of this.pending) {
        entry.resolve({ id, kind: 'failed', error: 'the analysis scan worker stopped responding' });
      }
      this.pending.clear();
    };
    this.worker = worker;
    return worker;
  }
}
