import { updateState } from '../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import type { SetSummary, TuneSet } from '@sidablist/tunes';
import { DjState, WritableStore } from '../dj-store';

/** Hydrates the library: every saved set's summary, the current set (with its first row
 *  selected), and `ready`. */
export function setSetsLibrary(store: WritableStore<DjState>) {
  return {
    setSetsLibrary: ({
      summaries,
      current,
    }: {
      summaries: readonly SetSummary[];
      current: TuneSet;
    }): void => {
      const actionMessage = createAction('set-sets-library');

      logInfo(LogType.Info, `Sets library ready: ${summaries.length} sets, current ${current.name}`);

      updateState(store, actionMessage, (state) => ({
        sets: {
          ...state.sets,
          ready: true,
          summaries,
          currentSetId: current.id,
          open: { [current.id]: current },
          selectedRowId: current.rows[0]?.id ?? null,
        },
      }));
    },
  };
}
