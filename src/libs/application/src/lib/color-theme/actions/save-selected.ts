import { updateState } from '../../with-devtools';
import { firstValueFrom } from 'rxjs';
import { ColorThemeKind, IColorThemeService } from '@teensyrom-nx/domain';
import { createAction, logError, logInfo, LogType } from '@teensyrom-nx/utils';
import { ColorThemeActionStore } from './action-store';

export function saveSelected(store: ColorThemeActionStore, service: IColorThemeService) {
  return {
    /** Saves the draft over the selected custom theme, keeping its name. The service alerts on failure. */
    saveSelected: async (): Promise<boolean> => {
      const theme = store.selectedTheme();
      if (!theme || theme.kind !== ColorThemeKind.Custom) {
        return false;
      }

      const actionMessage = createAction('save-selected-color-theme');
      logInfo(LogType.Start, 'ColorTheme: Saving selected theme', { actionMessage });
      updateState(store, actionMessage, (state) => ({ ...state, isSaving: true, error: null }));

      try {
        const saved = await firstValueFrom(
          service.updateTheme(theme.id, theme.name, store.draft())
        );
        updateState(store, actionMessage, (state) => ({
          ...state,
          themes: state.themes.map((t) => (t.id === saved.id ? saved : t)),
          isSaving: false,
        }));
        return true;
      } catch (error) {
        logError('ColorTheme: Failed to save theme:', error);
        updateState(store, actionMessage, (state) => ({
          ...state,
          isSaving: false,
          error: (error as Error)?.message || 'Failed to save the theme',
        }));
        return false;
      }
    },
  };
}
