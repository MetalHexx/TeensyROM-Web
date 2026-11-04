import { updateState } from '../../with-devtools';
import { createAction } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Sets the deck's own settings: slip and the live loop size in beats. A field left out keeps its
 *  value. */
export function setDeckSettings(store: WritableStore<DjState>) {
  return {
    setDeckSettings: ({
      slot,
      slip,
      liveLoopBeats,
    }: {
      slot: Slot;
      slip?: boolean;
      liveLoopBeats?: number;
    }): void => {
      const actionMessage = createAction('set-deck-settings');

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: {
            ...state.decks[slot],
            ...(slip === undefined ? {} : { slip }),
            ...(liveLoopBeats === undefined ? {} : { liveLoopBeats }),
          },
        },
      }));
    },
  };
}
