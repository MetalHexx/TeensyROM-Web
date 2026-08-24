import type { ReplayRequest, ReplayResponse, ReplayRunner } from './replay-runner';

/**
 * The real runner: a dedicated worker thread that keeps a deep jump's emulation off the main one, so
 * the frame clock keeps ticking and the packet stream stays unbroken while the replay runs.
 *
 * The worker is built on first use rather than in the constructor — a session that never scrubs
 * never pays for it — and every response is matched back to its request by `id`, since several can
 * be in flight and only the newest one is wanted.
 */
export class WorkerReplayRunner implements ReplayRunner {
  private worker: Worker | null = null;
  private readonly pending = new Map<number, (response: ReplayResponse) => void>();

  run(request: ReplayRequest): Promise<ReplayResponse> {
    const worker = this.ensureWorker();
    return new Promise<ReplayResponse>((resolve) => {
      this.pending.set(request.id, resolve);
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

    const worker = new Worker(new URL('./replay.worker', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<ReplayResponse>): void => {
      const resolve = this.pending.get(event.data.id);
      this.pending.delete(event.data.id);
      resolve?.(event.data);
    };
    // A worker that dies takes every promise waiting on it with it, which would leave the engine
    // holding an outstanding jump id forever and silently drop every jump after it.
    worker.onerror = (): void => {
      for (const [id, resolve] of this.pending) {
        resolve({ id, ok: false, error: 'the replay worker stopped responding' });
      }
      this.pending.clear();
    };
    this.worker = worker;
    return worker;
  }
}
