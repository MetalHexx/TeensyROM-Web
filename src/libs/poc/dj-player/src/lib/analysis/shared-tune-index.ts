import { Injectable, inject } from '@angular/core';
import { TUNE_INDEX_STORAGE } from './tune-index-storage';
import type { ITuneIndexStorage } from './tune-index-storage';
import type { TuneIndexRecord } from './tune-index.model';

/**
 * Page-level: the tune index's storage and its single-flight production guard, shared by every
 * deck. A loop point, an end point, a key and a length are facts about the tune, not about the deck
 * that found them, so once one deck has loaded or produced a record for a `(filename, subtune)`,
 * every other deck reaches it through this collaborator rather than its own storage round-trip or
 * its own scan.
 *
 * `exactCallsPerFrame`, `callsPerFrame` and `timingMode` ride along in every shared record even
 * though `TuneIndexService.produceRecord` reads them off the producing deck's own engine. This is a
 * recorded decision, not an accident: both decks emulate the same tune identically, so whichever
 * deck happens to produce the record, its rate fields are equally correct read by the other.
 */
@Injectable()
export class SharedTuneIndex {
  private readonly storage: ITuneIndexStorage = inject(TUNE_INDEX_STORAGE);

  /** One entry per `(filename, subtune)` currently being produced, keyed the same way storage keys
   *  its records. Removed the instant its run settles — success or failure alike — so the next load
   *  of a tune whose only attempt failed starts a fresh run rather than replaying a stale rejection. */
  private readonly inFlight = new Map<string, Promise<TuneIndexRecord | null>>();

  load(filename: string, subtune: number): TuneIndexRecord | null {
    return this.storage.load(filename, subtune);
  }

  save(record: TuneIndexRecord): void {
    this.storage.save(record);
  }

  /**
   * One production per (filename, subtune) at a time across every deck. A second caller arriving
   * while a run is in flight awaits the first's promise instead of starting its own. The entry is
   * removed as soon as the run settles, so a run that produced null is retried by the next load.
   */
  produceOnce(
    filename: string,
    subtune: number,
    run: () => Promise<TuneIndexRecord | null>
  ): Promise<TuneIndexRecord | null> {
    const key = this.keyFor(filename, subtune);
    const inFlight = this.inFlight.get(key);
    if (inFlight !== undefined) {
      return inFlight;
    }

    const production = run().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, production);
    return production;
  }

  private keyFor(filename: string, subtune: number): string {
    return `${filename}:${subtune}`;
  }
}
