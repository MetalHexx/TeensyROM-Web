import { updateState } from '../../with-devtools';
import { createAction } from '@teensyrom-nx/utils';
import { DeckBeatGrid, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Lands the grid a deck plays to, or clears it with null. */
export function setDeckBeatGrid(store: WritableStore<DjState>) {
  return {
    setDeckBeatGrid: ({
      slot,
      beatGrid,
    }: {
      slot: Slot;
      beatGrid: DeckBeatGrid | null;
    }): void => {
      const actionMessage = createAction('set-deck-beat-grid');

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], beatGrid },
        },
      }));
    },
  };
}
