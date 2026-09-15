import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Sets a deck's repeat-track flag. */
export function setDeckRepeat(store: WritableStore<DjState>) {
  return {
    setDeckRepeat: ({ slot, repeat }: { slot: Slot; repeat: boolean }): void => {
      const actionMessage = createAction('set-deck-repeat');

      logInfo(LogType.Info, `Deck ${slot} repeat -> ${repeat}`);

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], repeat },
        },
      }));
    },
  };
}
