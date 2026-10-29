import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Sets whether a finger is on a deck's pitch bend strip. Written at the touch and the lift only,
 *  never per message. */
export function setDeckHand(store: WritableStore<DjState>) {
  return {
    setDeckHand: ({ slot, held }: { slot: Slot; held: boolean }): void => {
      const actionMessage = createAction('set-deck-hand');

      logInfo(LogType.Info, `Deck ${slot} hand -> ${held ? 'held' : 'released'}`);

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], handHeld: held },
        },
      }));
    },
  };
}
