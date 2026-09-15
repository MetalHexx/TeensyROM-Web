import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DeckStructure, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Lands the loop/end structure background indexing found for a deck's loaded tune, and its length. */
export function setDeckStructure(store: WritableStore<DjState>) {
  return {
    setDeckStructure: ({
      slot,
      structure,
      lengthFrames,
    }: {
      slot: Slot;
      structure: DeckStructure;
      lengthFrames: number | null;
    }): void => {
      const actionMessage = createAction('set-deck-structure');

      logInfo(LogType.Info, `Deck ${slot} structure indexed`);

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], structure, lengthFrames },
        },
      }));
    },
  };
}
