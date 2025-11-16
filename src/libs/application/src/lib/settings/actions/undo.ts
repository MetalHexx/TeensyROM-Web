import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { SettingsState } from '../settings-state.interface';
import { WritableStore } from './index';

export function undo(writableStore: WritableStore<SettingsState>) {
  return {
    undo: (): void => {
      const actionMessage = createAction('undo');

      logInfo(LogType.Start, 'Undo: Starting undo operation', { actionMessage });

      const state = writableStore;
      const history = state.history();
      const currentPosition = state.historyPosition();

      // Validate history exists
      if (!history || history.length === 0) {
        logInfo(LogType.Info, 'Undo: No history available, cannot undo');
        return;
      }

      // Calculate target position
      let targetPosition: number;

      if (currentPosition === -1) {
        // At current (end), move to most recent history entry (last index)
        targetPosition = history.length - 1;
        logInfo(
          LogType.Info,
          `Undo: At current (-1), moving to most recent history entry at position ${targetPosition}`
        );
      } else if (currentPosition === 0) {
        // At oldest, cannot go back further - stop here
        logInfo(LogType.Info, 'Undo: Already at oldest history position (0), cannot undo further');
        return;
      } else {
        // Normal backward movement (toward older entries)
        targetPosition = currentPosition - 1;
        logInfo(
          LogType.Info,
          `Undo: Moving from position ${currentPosition} to ${targetPosition}`
        );
      }

      // Get historical settings
      const historicalSettings = history[targetPosition];

      if (!historicalSettings) {
        logInfo(LogType.Info, `Undo: No settings found at position ${targetPosition}`);
        return;
      }

      // Update state with historical settings
      updateState(writableStore, actionMessage, (state) => {
        const timestamp = Date.now();
        const currentSettings = state.settings; // Save current before overwriting
        const isLeavingCurrent = currentPosition === -1;

        logInfo(LogType.Success, `Undo: Applied settings from history position ${targetPosition}`);

        return {
          ...state,
          settings: historicalSettings,
          historyPosition: targetPosition,
          storedCurrent: isLeavingCurrent ? currentSettings : state.storedCurrent, // Store current only when leaving -1
          lastUpdated: timestamp,
        };
      });

      logInfo(LogType.Finish, 'Undo: Undo operation completed');
    },
  };
}
