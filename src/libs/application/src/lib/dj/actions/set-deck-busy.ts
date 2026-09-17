import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Sets a deck's busy flag: true for the whole span of a load or subtune switch, regardless of
 *  what status the deck is showing. */
export function setDeckBusy(store: WritableStore<DjState>) {
  return {
    setDeckBusy: ({ slot, busy }: { slot: Slot; busy: boolean }): void => {
      const actionMessage = createAction('set-deck-busy');

      logInfo(LogType.Info, `Deck ${slot} busy -> ${busy}`);

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], busy },
        },
      }));
    },
  };
}
