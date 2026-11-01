import type { BeatGridStore } from '../../ports';

/** A beat grid store for test beds that provide the DJ ports but never exercise grids: it holds
 *  nothing and accepts every save. */
export const EMPTY_BEAT_GRID_STORE: BeatGridStore = {
  load: () => Promise.resolve(null),
  save: () => Promise.resolve(),
};
