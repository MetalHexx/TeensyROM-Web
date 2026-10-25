import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DeckLoopsState, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Replaces a deck's whole loop state — the markers and detected moments of a tune attached, or
 *  the empty state of one detached. */
export function setDeckLoops(store: WritableStore<DjState>) {
  return {
    setDeckLoops: ({ slot, loops }: { slot: Slot; loops: DeckLoopsState }): void => {
      const actionMessage = createAction('set-deck-loops');

      logInfo(LogType.Info, `Deck ${slot} loops -> ${loops.markers.length} markers`);

      updateState(store, actionMessage, (state) => ({
        loops: { ...state.loops, [slot]: loops },
      }));
    },
  };
}
