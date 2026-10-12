import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction } from '@teensyrom-nx/utils';
import { clamp } from '@sidablist/core';
import { DeckMixState, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';
import { KEY_SEMITONE_RANGE } from '../mixer/scale-taper';

/** Merges a patch into one deck's mix state. Positions are stored at full resolution; only
 *  `keySemitones` is rounded and bounded to the whole-semitone range. Logs nothing — it fires on
 *  every drag tick. */
export function setDeckMix(store: WritableStore<DjState>) {
  return {
    setDeckMix: ({ slot, patch }: { slot: Slot; patch: Partial<DeckMixState> }): void => {
      const actionMessage = createAction('set-deck-mix');
      const applied: Partial<DeckMixState> =
        patch.keySemitones === undefined
          ? patch
          : {
              ...patch,
              keySemitones: clamp(
                Math.round(patch.keySemitones),
                -KEY_SEMITONE_RANGE,
                KEY_SEMITONE_RANGE
              ),
            };

      updateState(store, actionMessage, (state) => ({
        mix: {
          ...state.mix,
          [slot]: { ...state.mix[slot], ...applied },
        },
      }));
    },
  };
}
