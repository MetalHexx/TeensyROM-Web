import { updateState } from '../../with-devtools';
import { createAction } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';
import type { MoveStepBeats } from '../grid/beat-math';
import type { Slot } from '../slot';

/** Sets how many beats the deck's Move controls shift a loop or an edge by. */
export function setDeckMoveStep(store: WritableStore<DjState>) {
  return {
    setDeckMoveStep: ({
      slot,
      moveStepBeats,
    }: {
      slot: Slot;
      moveStepBeats: MoveStepBeats;
    }): void => {
      const actionMessage = createAction('set-deck-move-step');

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], moveStepBeats },
        },
      }));
    },
  };
}
