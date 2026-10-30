import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AnalysisScanner } from '@sidablist/analysis';
import type { RegisterRecord } from '@sidablist/core';
import { WorkerRegisterRecorder } from './worker-register-recorder';

const { scanners, recordRegistersMock, FakeScanFailedError } = vi.hoisted(() => {
  class FakeScanFailedError extends Error {}
  return {
    scanners: [] as { disposed: boolean }[],
    recordRegistersMock: vi.fn(),
    FakeScanFailedError,
  };
});

// `WorkerAnalysisScanner` starts a real `Worker` on first scan, which jsdom does not implement.
vi.mock('./worker-analysis-scanner', () => {
  class FakeWorkerAnalysisScanner {
    disposed = false;
    constructor() {
      scanners.push(this);
    }
    dispose(): void {
      this.disposed = true;
    }
  }
  return { WorkerAnalysisScanner: FakeWorkerAnalysisScanner };
});

vi.mock('@sidablist/analysis', () => ({
  recordRegisters: recordRegistersMock,
  ScanFailedError: FakeScanFailedError,
}));

vi.mock('@teensyrom-nx/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@teensyrom-nx/utils')>()),
  logWarn: vi.fn(),
}));

const RECORD: RegisterRecord = {
  frames: 1,
  values: new Uint8Array(25),
  retriggerEntries: new Uint32Array(0),
  retriggerRegisters: new Uint8Array(0),
  retriggerValues: new Uint8Array(0),
};

describe('WorkerRegisterRecorder', () => {
  beforeEach(() => {
    scanners.length = 0;
    recordRegistersMock.mockReset();
  });

  it("scans the tune on its own scanner and returns the scan's record", async () => {
    recordRegistersMock.mockResolvedValue(RECORD);
    const recorder = new WorkerRegisterRecorder();
    const bytes = new Uint8Array([1, 2, 3]);

    const record = await recorder.record(bytes, 2, 500);

    expect(record).toBe(RECORD);
    const [scanner, forwardedBytes, subtune, frames] = recordRegistersMock.mock.calls[0];
    expect(scanner).toBe(scanners[0] as unknown as AnalysisScanner);
    expect([forwardedBytes, subtune, frames]).toEqual([bytes, 2, 500]);
  });

  it('answers null when the scan fails', async () => {
    recordRegistersMock.mockRejectedValue(new FakeScanFailedError('the machine halted'));

    const record = await new WorkerRegisterRecorder().record(new Uint8Array(), 1, 10);

    expect(record).toBeNull();
  });

  it('does not swallow an error that is not a failed scan', async () => {
    recordRegistersMock.mockRejectedValue(new TypeError('bad bytes'));

    await expect(new WorkerRegisterRecorder().record(new Uint8Array(), 1, 10)).rejects.toThrow(
      'bad bytes'
    );
  });

  it('keeps a scanner per recorder and disposes it with the recorder', () => {
    const first = new WorkerRegisterRecorder();
    new WorkerRegisterRecorder();

    first.dispose();

    expect(scanners).toHaveLength(2);
    expect(scanners.map((scanner) => scanner.disposed)).toEqual([true, false]);
  });
});
