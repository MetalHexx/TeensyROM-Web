import { updateState } from '../../with-devtools';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';

/** Makes an open set current, with `selectedRowId` as the knob's selection in it. */
export function setCurrentSet(store: WritableStore<DjState>) {
  return {
    setCurrentSet: ({
      setId,
      selectedRowId,
    }: {
      setId: string;
      selectedRowId: string | null;
    }): void => {
      const actionMessage = createAction('set-current-set');

      logInfo(LogType.Info, `Current set -> ${setId}`);

      updateState(store, actionMessage, (state) => ({
        sets: { ...state.sets, currentSetId: setId, selectedRowId },
      }));
    },
  };
}
