import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Sets which subtune of the loaded tune a deck plays. */
export function setDeckSubtune(store: WritableStore<DjState>) {
  return {
    setDeckSubtune: ({ slot, subtune }: { slot: Slot; subtune: number }): void => {
      const actionMessage = createAction('set-deck-subtune');

      logInfo(LogType.Info, `Deck ${slot} subtune -> ${subtune}`);

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], subtune },
        },
      }));
    },
  };
}
