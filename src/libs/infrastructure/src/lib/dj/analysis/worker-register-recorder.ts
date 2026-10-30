import { recordRegisters, ScanFailedError } from '@sidablist/analysis';
import type { RegisterRecord } from '@sidablist/core';
import type { RegisterRecorder } from '@teensyrom-nx/application';
import { logWarn } from '@teensyrom-nx/utils';
import { WorkerAnalysisScanner } from './worker-analysis-scanner';

/**
 * `RegisterRecorder` over a worker of its own, separate from the indexer's: a deck's record scan
 * never waits behind an index scan, and an index scan never waits behind a record. One per deck
 * slot; the scanner starts its worker on the first scan and `dispose` ends it.
 */
export class WorkerRegisterRecorder implements RegisterRecorder {
  private readonly scanner = new WorkerAnalysisScanner();

  async record(bytes: Uint8Array, subtune: number, frames: number): Promise<RegisterRecord | null> {
    try {
      return await recordRegisters(this.scanner, bytes, subtune, frames);
    } catch (error) {
      if (error instanceof ScanFailedError) {
        logWarn(`WorkerRegisterRecorder: the register scan failed — ${error.message}`);
        return null;
      }
      throw error;
    }
  }

  dispose(): void {
    this.scanner.dispose();
  }
}
