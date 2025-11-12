import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { SettingsState } from '../settings-state.interface';
import { WritableStore } from './index';

export function clearHistory(writableStore: WritableStore<SettingsState>) {
  return {
    clearHistory: (): void => {
      const actionMessage = createAction('clear-history');

      logInfo(LogType.Start, 'ClearHistory: Clearing settings history', { actionMessage });

      updateState(writableStore, actionMessage, (state) => {
        const timestamp = Date.now();

        logInfo(LogType.Success, 'ClearHistory: History cleared');

        return {
          ...state,
          history: [], // Clear history completely
          historyPosition: -1, // Reset to current
          storedCurrent: null, // Clear stored current since history is cleared
          lastUpdated: timestamp,
        };
      });

      logInfo(LogType.Finish, 'ClearHistory: History clear completed');
    },
  };
}
