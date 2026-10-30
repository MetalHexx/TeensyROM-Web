import { updateState } from '../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, PendingRow, WritableStore } from '../dj-store';

/** Replaces the SIDs dropped into the card that are still fetching. */
export function setPendingRows(store: WritableStore<DjState>) {
  return {
    setPendingRows: ({ rows }: { rows: readonly PendingRow[] }): void => {
      const actionMessage = createAction('set-pending-rows');

      logInfo(LogType.Info, `Pending rows -> ${rows.length}`);

      updateState(store, actionMessage, (state) => ({
        sets: { ...state.sets, pending: rows },
      }));
    },
  };
}
