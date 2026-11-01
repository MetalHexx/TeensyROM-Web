import { updateState } from '../../with-devtools';
import { createAction } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Marks a deck as in the middle of a tap sequence. */
export function setDeckTapping(store: WritableStore<DjState>) {
  return {
    setDeckTapping: ({ slot, tapping }: { slot: Slot; tapping: boolean }): void => {
      const actionMessage = createAction('set-deck-tapping');

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], tapping },
        },
      }));
    },
  };
}
