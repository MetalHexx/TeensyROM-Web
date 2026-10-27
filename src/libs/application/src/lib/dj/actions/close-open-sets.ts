import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';

/** Closes every open working copy except the sets in `keep`. */
export function closeOpenSets(store: WritableStore<DjState>) {
  return {
    closeOpenSets: ({ keep }: { keep: readonly string[] }): void => {
      const actionMessage = createAction('close-open-sets');
      const closing = Object.keys(store.sets.open()).filter((id) => !keep.includes(id));
      if (closing.length === 0) {
        return;
      }

      logInfo(LogType.Info, `Closed ${closing.length} open sets`);

      updateState(store, actionMessage, (state) => ({
        sets: {
          ...state.sets,
          open: Object.fromEntries(
            Object.entries(state.sets.open).filter(([id]) => keep.includes(id))
          ),
        },
      }));
    },
  };
}
