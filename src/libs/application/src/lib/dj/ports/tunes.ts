import { InjectionToken } from '@angular/core';
import type { LoopPositionsStore, TuneInserter, TuneResolver } from '@sidablist/tunes';

/**
 * The tunes interfaces the application injects. The inserter and resolver are composed in
 * infrastructure, over the IndexedDB-backed `TuneStore` and a worker-backed `TuneIndexer` — no
 * application file ever names `TuneStore`, `TuneIndexer`, or `analysis`. `LoopPositionsStore` is
 * the one storage port the application injects directly, by design.
 */
export const TUNE_INSERTER = new InjectionToken<TuneInserter>('TUNE_INSERTER');
export const TUNE_RESOLVER = new InjectionToken<TuneResolver>('TUNE_RESOLVER');

/** The loop-positions store the application injects — the session implementation now, a
 *  permanent one later, behind the same port. */
export const LOOP_POSITIONS_STORE = new InjectionToken<LoopPositionsStore>('LOOP_POSITIONS_STORE');
