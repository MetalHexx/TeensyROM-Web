import { updateState } from '../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, SetsSaveStatus, WritableStore } from '../dj-store';

/** Sets the save lamp. */
export function setSetsSaveStatus(store: WritableStore<DjState>) {
  return {
    setSetsSaveStatus: ({ status }: { status: SetsSaveStatus }): void => {
      const actionMessage = createAction('set-sets-save-status');

      if (store.sets.save() === status) {
        return;
      }

      logInfo(LogType.Info, `Sets save -> ${status}`);

      updateState(store, actionMessage, (state) => ({ sets: { ...state.sets, save: status } }));
    },
  };
}
