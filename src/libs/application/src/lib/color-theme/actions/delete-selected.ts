import { updateState } from '../../with-devtools';
import { firstValueFrom } from 'rxjs';
import { ColorThemeKind, IColorThemeService } from '@teensyrom-nx/domain';
import { createAction, logError, logInfo, LogType } from '@teensyrom-nx/utils';
import { ColorThemeActionStore } from './action-store';

export function deleteSelected(store: ColorThemeActionStore, service: IColorThemeService) {
  return {
    /** Deletes the selected custom theme and clears the selection; the draft is kept. */
    deleteSelected: async (): Promise<boolean> => {
      const theme = store.selectedTheme();
      if (!theme || theme.kind !== ColorThemeKind.Custom) {
        return false;
      }

      const actionMessage = createAction('delete-selected-color-theme');
      logInfo(LogType.Start, 'ColorTheme: Deleting selected theme', { actionMessage });
      updateState(store, actionMessage, (state) => ({ ...state, isSaving: true, error: null }));

      try {
        await firstValueFrom(service.deleteTheme(theme.id));
        updateState(store, actionMessage, (state) => ({
          ...state,
          themes: state.themes.filter((t) => t.id !== theme.id),
          selectedThemeId: null,
          isSaving: false,
        }));
        return true;
      } catch (error) {
        logError('ColorTheme: Failed to delete theme:', error);
        updateState(store, actionMessage, (state) => ({
          ...state,
          isSaving: false,
          error: (error as Error)?.message || 'Failed to delete the theme',
        }));
        return false;
      }
    },
  };
}
