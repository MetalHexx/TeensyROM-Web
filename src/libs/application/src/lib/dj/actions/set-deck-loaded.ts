import { updateState } from '../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import type { TuneReference } from '@sidablist/tunes';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/**
 * Lands a resolved tune on a deck: sets `loaded` and the subtune/count the reference's identity
 * carries, and resets the position, length, structure and error left by whatever the deck was
 * previously playing.
 */
export function setDeckLoaded(store: WritableStore<DjState>) {
  return {
    setDeckLoaded: ({ slot, reference }: { slot: Slot; reference: TuneReference }): void => {
      const actionMessage = createAction('set-deck-loaded');

      logInfo(LogType.Info, `Deck ${slot} loaded ${reference.title}`);

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: {
            ...state.decks[slot],
            loaded: reference,
            subtune: reference.identity.subtune,
            subtuneCount: reference.subtuneCount,
            lengthFrames: null,
            structure: null,
            error: null,
          },
        },
        positions: { ...state.positions, [slot]: 0 },
      }));
    },
  };
}
