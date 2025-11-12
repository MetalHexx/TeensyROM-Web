import { updateState } from '@angular-architects/ngrx-toolkit';
import { firstValueFrom } from 'rxjs';
import { ISettingsService } from '@teensyrom-nx/domain';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { SettingsState } from '../settings-state.interface';
import { WritableStore } from './index';

export function saveSettings(writableStore: WritableStore<SettingsState>, settingsService: ISettingsService) {
  return {
    saveSettings: async (): Promise<void> => {
      const actionMessage = createAction('save-settings');

      logInfo(LogType.Start, 'SaveSettings: Starting settings save to backend', {
        actionMessage,
      });

      const currentSettings = writableStore.settings();

      if (!currentSettings) {
        logError('SaveSettings: No settings to save');
        return;
      }

      // Set saving state
      updateState(writableStore, actionMessage, (state) => ({
        ...state,
        isSaving: true,
        error: null,
      }));

      try {
        // Call infrastructure service to save settings
        await firstValueFrom(settingsService.saveSettings(currentSettings));

        logInfo(LogType.Success, 'SaveSettings: Settings saved successfully');

        // Clear saving flag on success (don't modify history)
        updateState(writableStore, actionMessage, (state) => ({
          ...state,
          isSaving: false,
          error: null,
        }));

        logInfo(LogType.Finish, 'SaveSettings: Settings save completed successfully');
      } catch (error) {
        const errorMessage = (error as Error)?.message || 'Failed to save settings';
        logError('SaveSettings: Failed to save settings:', error);

        // Set error state and clear saving flag
        updateState(writableStore, actionMessage, (state) => ({
          ...state,
          isSaving: false,
          error: errorMessage,
        }));
      }
    },
  };
}
