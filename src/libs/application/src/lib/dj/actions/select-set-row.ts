import { updateState } from '../../with-devtools';
import { createAction } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';

/** Moves the set knob's selection. A `turned` selection also counts a Select command, which a
 *  command at the end of the list still does. Selection follows every knob tick, so it never
 *  logs. */
export function selectSetRow(store: WritableStore<DjState>) {
  return {
    selectSetRow: ({ rowId, turned }: { rowId: string | null; turned: boolean }): void => {
      const actionMessage = createAction('select-set-row');

      updateState(store, actionMessage, (state) => ({
        sets: {
          ...state.sets,
          selectedRowId: rowId,
          selectTurns: turned ? state.sets.selectTurns + 1 : state.sets.selectTurns,
        },
      }));
    },
  };
}
