import { updateState } from '../../with-devtools';
import { createAction } from '@teensyrom-nx/utils';
import { DeckLoopsState, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Publishes the bounds the engine is enforcing for a deck's running marker, or null with none. */
export function setRunningBounds(store: WritableStore<DjState>) {
  return {
    setRunningBounds: ({
      slot,
      runningBounds,
    }: {
      slot: Slot;
      runningBounds: DeckLoopsState['runningBounds'];
    }): void => {
      const actionMessage = createAction('set-running-bounds');

      updateState(store, actionMessage, (state) => ({
        loops: {
          ...state.loops,
          [slot]: { ...state.loops[slot], runningBounds },
        },
      }));
    },
  };
}
