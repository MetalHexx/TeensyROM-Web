import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ScanMessage, ScanRequest } from '@sidablist/analysis';
import { WorkerAnalysisScanner } from './worker-analysis-scanner';

/**
 * Stands in for the browser's `Worker`, which jsdom does not implement — the fake exposes the same
 * surface `WorkerAnalysisScanner` touches (construction, `postMessage`, `onmessage`/`onerror`,
 * `terminate`) and lets a test fire either handler by hand, the way the real worker thread would.
 */
class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent<ScanMessage>) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readonly posted: ScanRequest[] = [];
  terminated = false;

  constructor(
    readonly url: string | URL,
    readonly options?: WorkerOptions
  ) {
    FakeWorker.instances.push(this);
  }

  postMessage(message: ScanRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Delivers a message as the real worker's `postMessage` would. */
  emitMessage(message: ScanMessage): void {
    this.onmessage?.({ data: message } as MessageEvent<ScanMessage>);
  }

  /** Fires the worker's `onerror`, as the browser does on an uncaught exception in the thread. */
  emitError(): void {
    this.onerror?.(new Event('error'));
  }
}

function installFakeWorker(): void {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
}

/** A well-formed-enough request: `WorkerAnalysisScanner` never inspects `file`, only routes the
 *  request through to `postMessage` and correlates the response by `id`. */
function buildRequest(id: number): ScanRequest {
  return {
    id,
    session: 1,
    file: {} as unknown as ScanRequest['file'],
    subtune: 1,
    maxFrames: 1000,
  };
}

function doneMessage(id: number): ScanMessage {
  return {
    id,
    kind: 'done',
    output: {
      sectionBoundaries: [],
      detectedMoments: [],
      tonic: null,
      mode: null,
      camelot: null,
      tuningReferenceHz: null,
      tuningCents: null,
      keyConfidence: 'none',
      scalePitchClasses: [],
      dominantIntervalFrames: null,
      pulseConfidence: 'none',
      nativeTempo: null,
      loopStartFrame: null,
      loopPeriodFrames: null,
      endedAtFrame: null,
      callsPerFrame: 50,
      exactCallsPerFrame: 50,
      timingMode: 'exact',
      // Only the discriminant and correlation matter to `WorkerAnalysisScanner` — everything else
      // in `ScanOutput` just has to be present for the type, never read on this path.
    } as unknown as Extract<ScanMessage, { kind: 'done' }>['output'],
  };
}

describe('WorkerAnalysisScanner', () => {
  let scanner: WorkerAnalysisScanner;

  beforeEach(() => {
    installFakeWorker();
    scanner = new WorkerAnalysisScanner();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds one worker lazily and reuses it across scans', () => {
    void scanner.scan(buildRequest(1));
    void scanner.scan(buildRequest(2));

    expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0].posted.map((r) => r.id)).toEqual([1, 2]);
  });

  it('resolves scan() from the worker\'s own done message, matched by id', async () => {
    const result = scanner.scan(buildRequest(1));
    const worker = FakeWorker.instances[0];

    worker.emitMessage(doneMessage(1));

    await expect(result).resolves.toEqual(doneMessage(1));
  });

  describe('when the worker errors', () => {
    it('resolves every pending scan with a failed result rather than leaving them hanging', async () => {
      const first = scanner.scan(buildRequest(1));
      const second = scanner.scan(buildRequest(2));
      const worker = FakeWorker.instances[0];

      worker.emitError();

      await expect(first).resolves.toEqual({
        id: 1,
        kind: 'failed',
        error: 'the analysis scan worker stopped responding',
      });
      await expect(second).resolves.toEqual({
        id: 2,
        kind: 'failed',
        error: 'the analysis scan worker stopped responding',
      });
    });

    it('terminates the dead worker so it is never posted to again', () => {
      void scanner.scan(buildRequest(1));
      const worker = FakeWorker.instances[0];

      worker.emitError();

      expect(worker.terminated).toBe(true);
    });

    it('builds a brand-new worker for the next scan() instead of reusing the terminated one', async () => {
      const first = scanner.scan(buildRequest(1));
      const deadWorker = FakeWorker.instances[0];
      deadWorker.emitError();
      await first;

      const second = scanner.scan(buildRequest(2));

      expect(FakeWorker.instances).toHaveLength(2);
      const freshWorker = FakeWorker.instances[1];
      expect(freshWorker).not.toBe(deadWorker);
      // Posted to the fresh instance, not replayed into the terminated one.
      expect(freshWorker.posted.map((r) => r.id)).toEqual([2]);
      expect(deadWorker.posted.map((r) => r.id)).toEqual([1]);

      freshWorker.emitMessage(doneMessage(2));
      await expect(second).resolves.toEqual(doneMessage(2));
    });

    it('a scan started after the error is unaffected by the dead worker firing again', async () => {
      const first = scanner.scan(buildRequest(1));
      const deadWorker = FakeWorker.instances[0];
      deadWorker.emitError();
      await first;

      const second = scanner.scan(buildRequest(2));
      // A stray late message from the terminated worker must not resolve the new scan — it belongs
      // to a different Worker instance the scanner no longer holds a reference to.
      deadWorker.emitMessage(doneMessage(2));

      const freshWorker = FakeWorker.instances[1];
      freshWorker.emitMessage(doneMessage(2));

      await expect(second).resolves.toEqual(doneMessage(2));
    });
  });

  it('forwards progress messages without resolving the scan', async () => {
    const onProgress = vi.fn();
    const result = scanner.scan(buildRequest(1), onProgress);
    const worker = FakeWorker.instances[0];

    worker.emitMessage({ id: 1, kind: 'progress', frame: 42 });
    expect(onProgress).toHaveBeenCalledWith(42);

    worker.emitMessage(doneMessage(1));
    await expect(result).resolves.toEqual(doneMessage(1));
  });

  it('dispose() terminates the worker and drops every pending scan without resolving it', () => {
    const result = scanner.scan(buildRequest(1));
    const worker = FakeWorker.instances[0];
    const thenSpy = vi.fn();
    void result.then(thenSpy);

    scanner.dispose();

    expect(worker.terminated).toBe(true);
    // Nothing left to resolve it — the assertion is just that dispose() itself does not throw and
    // a message arriving for the disposed worker afterwards is silently ignored.
    worker.emitMessage(doneMessage(1));
    expect(thenSpy).not.toHaveBeenCalled();
  });
});
