import { InjectionToken } from '@angular/core';
import type {
  SetStore,
  TuneInserter,
  TuneMemoryStore,
  TuneResolver,
} from '@sidablist/tunes';

/**
 * The tunes interfaces the application injects. The inserter and resolver are composed in
 * infrastructure, over the IndexedDB-backed `TuneStore` and a worker-backed `TuneIndexer` — no
 * application file ever names `TuneStore`, `TuneIndexer`, or `analysis`. The set and tune-memory
 * stores are the storage ports the application injects directly, by design.
 */
export const TUNE_INSERTER = new InjectionToken<TuneInserter>('TUNE_INSERTER');
export const TUNE_RESOLVER = new InjectionToken<TuneResolver>('TUNE_RESOLVER');

/** The storage for the saved sets: one document per set, kept on the server. */
export const SET_STORE = new InjectionToken<SetStore>('SET_STORE');

/** The storage for each tune's latest memory, keyed by its hash, kept on the server. */
export const TUNE_MEMORY_STORE = new InjectionToken<TuneMemoryStore>('TUNE_MEMORY_STORE');
