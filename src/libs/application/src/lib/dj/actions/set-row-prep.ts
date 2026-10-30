import { updateState } from '../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, RowPrep, WritableStore } from '../dj-store';

function samePrep(a: RowPrep | null, b: RowPrep | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  if (a.phase === 'unavailable' && b.phase === 'unavailable') {
    return a.reason === b.reason;
  }
  return a.phase === b.phase;
}

/** Sets what a row is being prepared for (analyzing, or unavailable), or clears it with null. */
export function setRowPrep(store: WritableStore<DjState>) {
  return {
    setRowPrep: ({ rowId, prep }: { rowId: string; prep: RowPrep | null }): void => {
      const actionMessage = createAction('set-row-prep');

      if (samePrep(store.sets.prep()[rowId] ?? null, prep)) {
        return;
      }

      logInfo(LogType.Info, `Row ${rowId} prep -> ${prep?.phase ?? 'ready'}`);

      updateState(store, actionMessage, (state) => {
        const others = Object.fromEntries(
          Object.entries(state.sets.prep).filter(([id]) => id !== rowId)
        );
        return {
          sets: { ...state.sets, prep: prep === null ? others : { ...others, [rowId]: prep } },
        };
      });
    },
  };
}
