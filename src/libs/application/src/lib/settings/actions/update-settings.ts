import { updateState } from '@angular-architects/ngrx-toolkit';
import { Settings } from '@teensyrom-nx/domain';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { SettingsState } from '../settings-state.interface';
import { WritableStore } from './index';

const MAX_HISTORY_ENTRIES = 50;

export interface UpdateSettingsParams {
  settings: Partial<Settings>;
}

export function updateSettings(writableStore: WritableStore<SettingsState>) {
  return {
    updateSettings: (params: UpdateSettingsParams): void => {
      const actionMessage = createAction('update-settings');

      logInfo(LogType.Start, 'UpdateSettings: Updating settings with history tracking', {
        actionMessage,
        params,
      });

      const currentSettings = writableStore.settings();

      if (!currentSettings) {
        logInfo(LogType.Info, 'UpdateSettings: No current settings, cannot update');
        return;
      }

      // Merge partial updates with current settings
      const updatedSettings: Settings = {
        ...currentSettings,
        ...params.settings,
        // Deep merge nested objects if they exist in params
        playerSettings: params.settings.playerSettings
          ? { ...currentSettings.playerSettings, ...params.settings.playerSettings }
          : currentSettings.playerSettings,
        fileTransferSettings: params.settings.fileTransferSettings
          ? { ...currentSettings.fileTransferSettings, ...params.settings.fileTransferSettings }
          : currentSettings.fileTransferSettings,
        searchSettings: params.settings.searchSettings
          ? { ...currentSettings.searchSettings, ...params.settings.searchSettings }
          : currentSettings.searchSettings,
        appSettings: params.settings.appSettings
          ? { ...currentSettings.appSettings, ...params.settings.appSettings }
          : currentSettings.appSettings,
      };

      updateState(writableStore, actionMessage, (state) => {
        const timestamp = Date.now();

        // Add current state to history before updating
        let newHistory = [...state.history, currentSettings];

        // Trim history if exceeding max entries (FIFO)
        if (newHistory.length > MAX_HISTORY_ENTRIES) {
          logInfo(
            LogType.Info,
            `UpdateSettings: History exceeds ${MAX_HISTORY_ENTRIES} entries, trimming oldest`
          );
          newHistory = newHistory.slice(newHistory.length - MAX_HISTORY_ENTRIES);
        }

        logInfo(
          LogType.Success,
          `UpdateSettings: Settings updated, history now has ${newHistory.length} entries`
        );

        return {
          ...state,
          settings: updatedSettings,
          history: newHistory,
          historyPosition: -1, // Reset to current (end of history)
          storedCurrent: null, // Clear stored current since we're now at actual current
          lastUpdated: timestamp,
        };
      });

      logInfo(LogType.Finish, 'UpdateSettings: Settings update completed');
    },
  };
}
