import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';

/** Drops a deleted set from the tree. */
export function removeSetSummary(store: WritableStore<DjState>) {
  return {
    removeSetSummary: ({ setId }: { setId: string }): void => {
      const actionMessage = createAction('remove-set-summary');

      logInfo(LogType.Info, `Set ${setId} removed from the library`);

      updateState(store, actionMessage, (state) => ({
        sets: {
          ...state.sets,
          summaries: state.sets.summaries.filter((summary) => summary.id !== setId),
        },
      }));
    },
  };
}
