import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { SettingsState } from '../settings-state.interface';
import { WritableStore } from './index';

export function redo(writableStore: WritableStore<SettingsState>) {
  return {
    redo: (): void => {
      const actionMessage = createAction('redo');

      logInfo(LogType.Start, 'Redo: Starting redo operation', { actionMessage });

      const state = writableStore;
      const history = state.history();
      const currentPosition = state.historyPosition();

      // Validate history exists
      if (!history || history.length === 0) {
        logInfo(LogType.Info, 'Redo: No history available, cannot redo');
        return;
      }

      // Already at current (end), cannot redo
      if (currentPosition === -1) {
        logInfo(LogType.Info, 'Redo: Already at current (-1), cannot redo');
        return;
      }

      // Calculate target position
      const targetPosition = currentPosition + 1;

      // Check if target is beyond history
      if (targetPosition >= history.length) {
        logInfo(
          LogType.Info,
          `Redo: Target position ${targetPosition} beyond history length ${history.length}, moving to current`
        );
        // Move to current (end) and restore stored current settings
        updateState(writableStore, actionMessage, (state) => {
          const timestamp = Date.now();
          const restoredSettings = state.storedCurrent || state.settings; // Restore stored current or keep existing

          logInfo(LogType.Success, 'Redo: Moved to current (end of history)');

          return {
            ...state,
            settings: restoredSettings,
            historyPosition: -1, // Move to current
            storedCurrent: null, // Clear stored current
            lastUpdated: timestamp,
          };
        });
        return;
      }

      // Get historical settings
      const historicalSettings = history[targetPosition];

      if (!historicalSettings) {
        logInfo(LogType.Info, `Redo: No settings found at position ${targetPosition}`);
        return;
      }

      logInfo(
        LogType.Info,
        `Redo: Moving from position ${currentPosition} to ${targetPosition}`
      );

      // Update state with historical settings
      updateState(writableStore, actionMessage, (state) => {
        const timestamp = Date.now();

        logInfo(LogType.Success, `Redo: Applied settings from history position ${targetPosition}`);

        return {
          ...state,
          settings: historicalSettings,
          historyPosition: targetPosition,
          lastUpdated: timestamp,
        };
      });

      logInfo(LogType.Finish, 'Redo: Redo operation completed');
    },
  };
}
