import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction } from '@teensyrom-nx/utils';
import { DeckVoiceState, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Lands the engine-reported tempo multiplier, the speed fader's own value, whether a nudge is
 *  held, and the voice states on a deck. Logs nothing — it runs on every speed-fader tick and every
 *  nudge and hold press and release. */
export function setDeckEngineControls(store: WritableStore<DjState>) {
  return {
    setDeckEngineControls: ({
      slot,
      speed,
      faderSpeed,
      nudging,
      voices,
    }: {
      slot: Slot;
      speed: number;
      faderSpeed: number;
      nudging: boolean;
      voices: readonly DeckVoiceState[];
    }): void => {
      const actionMessage = createAction('set-deck-engine-controls');

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], speed, faderSpeed, nudging, voices },
        },
      }));
    },
  };
}
