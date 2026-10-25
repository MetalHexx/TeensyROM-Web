import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Sets which marker a deck's engine is running and which is queued, and whether the selection has
 *  moved since a jump was queued. */
export function setLoopActivity(store: WritableStore<DjState>) {
  return {
    setLoopActivity: ({
      slot,
      runningId,
      queuedId,
      selectionMovedWhileQueued,
    }: {
      slot: Slot;
      runningId: string | null;
      queuedId: string | null;
      selectionMovedWhileQueued: boolean;
    }): void => {
      const actionMessage = createAction('set-loop-activity');

      logInfo(
        LogType.Info,
        `Deck ${slot} marker activity -> running ${runningId ?? 'none'}, queued ${
          queuedId ?? 'none'
        }`
      );

      updateState(store, actionMessage, (state) => ({
        loops: {
          ...state.loops,
          [slot]: { ...state.loops[slot], runningId, queuedId, selectionMovedWhileQueued },
        },
      }));
    },
  };
}
