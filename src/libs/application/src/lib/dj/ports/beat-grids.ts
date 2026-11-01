import { InjectionToken } from '@angular/core';

/** One subtune's tapped correction: the beat length and where beat one falls, in play calls. */
export interface StoredBeatGrid {
  readonly subtune: number;
  readonly beatFrames: number;
  readonly beatOneFrame: number;
}

/** A tune's tapped corrections, one per subtune that has one. A fact about the tune, not about any
 *  set. */
export interface TuneBeatGrids {
  readonly sidHash: string;
  readonly subtunes: readonly StoredBeatGrid[];
  readonly updated: string;
}

/** The storage for each tune's tapped beat grids, keyed by its hash, kept on the server. */
export interface BeatGridStore {
  load(sidHash: string): Promise<TuneBeatGrids | null>;
  save(grids: TuneBeatGrids): Promise<void>;
}

export const BEAT_GRID_STORE = new InjectionToken<BeatGridStore>('BEAT_GRID_STORE');
