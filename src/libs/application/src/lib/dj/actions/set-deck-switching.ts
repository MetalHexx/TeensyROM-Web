import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Sets a deck's switching flag: true only while `DeckService` runs a load or subtune switch. */
export function setDeckSwitching(store: WritableStore<DjState>) {
  return {
    setDeckSwitching: ({ slot, switching }: { slot: Slot; switching: boolean }): void => {
      const actionMessage = createAction('set-deck-switching');

      logInfo(LogType.Info, `Deck ${slot} switching -> ${switching}`);

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], switching },
        },
      }));
    },
  };
}
