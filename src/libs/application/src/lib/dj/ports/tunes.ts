import { InjectionToken } from '@angular/core';
import type { TuneInserter, TuneResolver } from '@sidablist/tunes';

/**
 * The two tunes interfaces the application injects. Both are composed in infrastructure, over the
 * IndexedDB-backed `TuneStore` and a worker-backed `TuneIndexer` — no application file ever names
 * `TuneStore`, `TuneIndexer`, or `analysis`.
 */
export const TUNE_INSERTER = new InjectionToken<TuneInserter>('TUNE_INSERTER');
export const TUNE_RESOLVER = new InjectionToken<TuneResolver>('TUNE_RESOLVER');
