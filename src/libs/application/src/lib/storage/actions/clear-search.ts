import { StorageState } from '../storage-store';
import { WritableStore } from '../storage-helpers';
import { createAction, LogType, logInfo } from '@teensyrom-nx/utils';
import { updateState } from '@angular-architects/ngrx-toolkit';

export function clearSearch(store: WritableStore<StorageState>) {
  return {
    clearSearch: ({
      deviceId,
    }: {
      deviceId: string;
    }): void => {
      const actionMessage = createAction('clear-search');

      logInfo(LogType.Info, `Clearing unified search state for device ${deviceId}`);

      updateState(store, actionMessage, (state) => {
        const updatedSearchState = { ...state.searchState };
        delete updatedSearchState[deviceId];

        return {
          searchState: updatedSearchState,
        };
      });
    },
  };
}
