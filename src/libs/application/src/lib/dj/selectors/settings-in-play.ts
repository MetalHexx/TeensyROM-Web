import { computed } from '@angular/core';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

export interface SettingsInPlaySummary {
  /** The marker whose own settings are in play, or null for the main track's. */
  readonly markerId: string | null;
  /** The marker's name, else 'Item N' by list position; or 'Main'. */
  readonly name: string;
}

const MAIN: SettingsInPlaySummary = { markerId: null, name: 'Main' };

/** Which settings are in play on a deck: the main track's, or a marker's own. Reads the loop state
 *  only, never the playhead position. */
export function settingsInPlay(store: WritableStore<DjState>) {
  return {
    settingsInPlay: (slot: Slot) => {
      const loops = store.loops[slot];

      return computed<SettingsInPlaySummary>(
        () => {
          const { markers, settingsInPlayId } = loops();
          const index = markers.findIndex((marker) => marker.id === settingsInPlayId);
          return settingsInPlayId === null || index < 0
            ? MAIN
            : { markerId: settingsInPlayId, name: markers[index].name ?? `Item ${index + 1}` };
        },
        { equal: (a, b) => a.markerId === b.markerId && a.name === b.name }
      );
    },
  };
}
