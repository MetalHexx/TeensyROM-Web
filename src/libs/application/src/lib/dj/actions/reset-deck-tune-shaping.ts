import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Returns a deck's tune-shaping controls (cutoff, resonance, pulse width, key, filter mode) and
 *  its detected key to home. Level, the crossfader and the key display format are left alone. */
export function resetDeckTuneShaping(store: WritableStore<DjState>) {
  return {
    resetDeckTuneShaping: ({ slot }: { slot: Slot }): void => {
      const actionMessage = createAction('reset-deck-tune-shaping');

      logInfo(LogType.Info, `Deck ${slot} tune shaping reset`);

      updateState(store, actionMessage, (state) => ({
        mix: {
          ...state.mix,
          [slot]: {
            ...state.mix[slot],
            cutoff: 0,
            resonance: 0,
            pulseWidth: 0,
            keySemitones: 0,
            filterMode: null,
          },
        },
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], detectedKey: null },
        },
      }));
    },
  };
}
