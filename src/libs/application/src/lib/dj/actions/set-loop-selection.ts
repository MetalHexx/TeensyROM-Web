import { updateState } from '../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Sets which marker a deck has selected, and whether the selection has moved since a jump was
 *  queued. */
export function setLoopSelection(store: WritableStore<DjState>) {
  return {
    setLoopSelection: ({
      slot,
      selectedId,
      selectionMovedWhileQueued,
    }: {
      slot: Slot;
      selectedId: string | null;
      selectionMovedWhileQueued: boolean;
    }): void => {
      const actionMessage = createAction('set-loop-selection');

      logInfo(LogType.Info, `Deck ${slot} marker selection -> ${selectedId ?? 'none'}`);

      updateState(store, actionMessage, (state) => ({
        loops: {
          ...state.loops,
          [slot]: { ...state.loops[slot], selectedId, selectionMovedWhileQueued },
        },
      }));
    },
  };
}
