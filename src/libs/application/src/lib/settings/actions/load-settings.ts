import { updateState } from '@angular-architects/ngrx-toolkit';
import { firstValueFrom } from 'rxjs';
import { ISettingsService, Settings } from '@teensyrom-nx/domain';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { SettingsState } from '../settings-state.interface';
import { WritableStore } from './index';

export function loadSettings(writableStore: WritableStore<SettingsState>, settingsService: ISettingsService) {
  return {
    loadSettings: async (): Promise<void> => {
      const actionMessage = createAction('load-settings');

      logInfo(LogType.Start, 'LoadSettings: Starting settings load from backend', {
        actionMessage,
      });

      // Set loading state
      updateState(writableStore, actionMessage, (state) => ({
        ...state,
        isLoading: true,
        error: null,
      }));

      try {
        // Call infrastructure service to get settings
        const settings: Settings = await firstValueFrom(settingsService.getSettings());

        logInfo(LogType.Success, 'LoadSettings: Settings loaded successfully');

        // Update state with loaded settings and initialize empty history
        updateState(writableStore, actionMessage, (state) => {
          const timestamp = Date.now();

          return {
            ...state,
            settings,
            history: [], // Start with empty history
            historyPosition: -1, // At current (end of history)
            isLoading: false,
            error: null,
            lastUpdated: timestamp,
          };
        });

        logInfo(LogType.Finish, 'LoadSettings: Settings load completed successfully');
      } catch (error) {
        const errorMessage = (error as Error)?.message || 'Failed to load settings';
        logError('LoadSettings: Failed to load settings:', error);

        // Set error state
        updateState(writableStore, actionMessage, (state) => ({
          ...state,
          isLoading: false,
          error: errorMessage,
        }));
      }
    },
  };
}
