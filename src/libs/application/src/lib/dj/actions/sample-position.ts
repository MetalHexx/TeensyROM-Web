import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Records a deck's current playhead frame. Runs once per animation frame — no lifecycle logging. */
export function samplePosition(store: WritableStore<DjState>) {
  return {
    samplePosition: ({ slot, positionFrames }: { slot: Slot; positionFrames: number }): void => {
      const actionMessage = createAction('sample-position');

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], positionFrames },
        },
      }));
    },
  };
}
