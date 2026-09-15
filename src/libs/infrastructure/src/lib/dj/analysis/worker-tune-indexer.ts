import { Injectable } from '@angular/core';
import { indexTune } from '@sidablist/analysis';
import type { TuneIndexer, TuneIdentity } from '@sidablist/tunes';
import type { TuneIndexRecord } from '@sidablist/analysis';
import { WorkerAnalysisScanner } from './worker-analysis-scanner';

/**
 * `TuneIndexer` over a worker-backed `WorkerAnalysisScanner` — the application's only reach into
 * `analysis`, and it stays inside this module (see `providers.ts`). One scanner for the app's
 * whole lifetime: `@Injectable({ providedIn: 'root' })`, never disposed. The scanner itself starts
 * its worker lazily, on the first scan — see `WorkerAnalysisScanner` — so a session that never
 * indexes a tune never pays for the worker either.
 */
@Injectable({ providedIn: 'root' })
export class WorkerTuneIndexer implements TuneIndexer {
  private readonly scanner = new WorkerAnalysisScanner();

  index(bytes: Uint8Array, identity: TuneIdentity): Promise<TuneIndexRecord> {
    return indexTune(this.scanner, bytes, identity);
  }
}
