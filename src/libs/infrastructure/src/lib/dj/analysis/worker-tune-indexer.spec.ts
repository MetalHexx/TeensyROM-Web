import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { AnalysisScanner, TuneIndexRecord, TuneIndexIdentity } from '@sidablist/analysis';
import { WorkerTuneIndexer } from './worker-tune-indexer';

// `vi.mock` factories are hoisted above every import, so the spies they close over have to be
// hoisted with them (`vi.hoisted`) rather than declared as ordinary top-level `const`s.
const { scannerConstructed, indexTuneMock } = vi.hoisted(() => ({
  scannerConstructed: vi.fn(),
  indexTuneMock: vi.fn(
    async (
      _scanner: AnalysisScanner,
      _bytes: Uint8Array,
      _identity: TuneIndexIdentity
    ): Promise<TuneIndexRecord> =>
      ({ sidHash: 'unused', subtune: 1 }) as unknown as TuneIndexRecord
  ),
}));

// `WorkerAnalysisScanner` starts a real `Worker` on first scan, which jsdom does not implement —
// the fake stands in for it so this spec can prove the wiring (one scanner, forwarded to
// `indexTune`) without ever touching a browser Worker.
vi.mock('./worker-analysis-scanner', () => {
  class FakeWorkerAnalysisScanner {
    constructor() {
      scannerConstructed();
    }
  }
  return { WorkerAnalysisScanner: FakeWorkerAnalysisScanner };
});

vi.mock('@sidablist/analysis', () => ({ indexTune: indexTuneMock }));

describe('WorkerTuneIndexer', () => {
  beforeEach(() => {
    scannerConstructed.mockClear();
    indexTuneMock.mockClear();
    TestBed.configureTestingModule({ providers: [WorkerTuneIndexer] });
  });

  it('forwards index() to indexTune with its own scanner, bytes and identity', async () => {
    const indexer = TestBed.inject(WorkerTuneIndexer);
    const bytes = new Uint8Array([1, 2, 3]);
    const identity = { sidHash: 'abc123', subtune: 1 };

    await indexer.index(bytes, identity);

    expect(indexTuneMock).toHaveBeenCalledTimes(1);
    const [, forwardedBytes, forwardedIdentity] = indexTuneMock.mock.calls[0];
    expect(forwardedBytes).toBe(bytes);
    expect(forwardedIdentity).toBe(identity);
  });

  it('starts the scanner once, reusing the same instance across repeated index() calls', async () => {
    const indexer = TestBed.inject(WorkerTuneIndexer);

    await indexer.index(new Uint8Array(), { sidHash: 'a', subtune: 1 });
    await indexer.index(new Uint8Array(), { sidHash: 'b', subtune: 1 });

    expect(scannerConstructed).toHaveBeenCalledTimes(1);
    const [firstScanner] = indexTuneMock.mock.calls[0];
    const [secondScanner] = indexTuneMock.mock.calls[1];
    expect(secondScanner).toBe(firstScanner);
  });
});
