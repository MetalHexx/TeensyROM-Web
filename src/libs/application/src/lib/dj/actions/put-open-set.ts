import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction } from '@teensyrom-nx/utils';
import { summaryOf, type TuneSet } from '@sidablist/tunes';
import { DjState, WritableStore } from '../dj-store';

/** Puts a working copy of a set in, and upserts its summary. A row's memory changes on every knob
 *  tick, so this never logs. */
export function putOpenSet(store: WritableStore<DjState>) {
  return {
    putOpenSet: ({ set }: { set: TuneSet }): void => {
      const actionMessage = createAction('put-open-set');
      const summary = summaryOf(set);

      updateState(store, actionMessage, (state) => ({
        sets: {
          ...state.sets,
          open: { ...state.sets.open, [set.id]: set },
          summaries: state.sets.summaries.some((candidate) => candidate.id === set.id)
            ? state.sets.summaries.map((candidate) => (candidate.id === set.id ? summary : candidate))
            : [...state.sets.summaries, summary],
        },
      }));
    },
  };
}
