import { updateState } from '../../with-devtools';
import { createAction } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Records a deck's current playhead frame, on a transport transition — never per frame. No
 *  lifecycle logging. Writes `positions` alone, so `decks` keeps its identity and nothing that
 *  reads it recomputes. */
export function samplePosition(store: WritableStore<DjState>) {
  return {
    samplePosition: ({ slot, positionFrames }: { slot: Slot; positionFrames: number }): void => {
      const actionMessage = createAction('sample-position');

      updateState(store, actionMessage, (state) => ({
        positions: { ...state.positions, [slot]: positionFrames },
      }));
    },
  };
}
