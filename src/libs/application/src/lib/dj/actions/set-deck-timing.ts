import { updateState } from '../../with-devtools';
import { createAction } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Lands the loaded tune's play-call interval on a deck — what turns its position in play calls
 *  into time. Logs nothing; it runs once per load and subtune switch. */
export function setDeckTiming(store: WritableStore<DjState>) {
  return {
    setDeckTiming: ({
      slot,
      playCallIntervalUs,
    }: {
      slot: Slot;
      playCallIntervalUs: number | null;
    }): void => {
      const actionMessage = createAction('set-deck-timing');

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], playCallIntervalUs },
        },
      }));
    },
  };
}
