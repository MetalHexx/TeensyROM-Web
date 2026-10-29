import { updateState } from '@angular-architects/ngrx-toolkit';
import { firstValueFrom } from 'rxjs';
import { ColorTheme, ColorThemeKind, IColorThemeService } from '@teensyrom-nx/domain';
import { createAction, logError, logInfo, LogType } from '@teensyrom-nx/utils';
import { ColorThemeActionStore } from './action-store';

/** Shipped themes first, then custom themes sorted by name. */
function withCustomSorted(themes: ColorTheme[]): ColorTheme[] {
  const shipped = themes.filter((t) => t.kind === ColorThemeKind.Shipped);
  const custom = themes
    .filter((t) => t.kind === ColorThemeKind.Custom)
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...shipped, ...custom];
}

export function saveAs(store: ColorThemeActionStore, service: IColorThemeService) {
  return {
    /** Saves the draft as a new custom theme and selects it. The service alerts on failure. */
    saveAs: async (name: string): Promise<boolean> => {
      const actionMessage = createAction('save-color-theme-as');
      logInfo(LogType.Start, 'ColorTheme: Saving draft as a new theme', { actionMessage });
      updateState(store, actionMessage, (state) => ({ ...state, isSaving: true, error: null }));

      try {
        const created = await firstValueFrom(service.createTheme(name, store.draft()));
        updateState(store, actionMessage, (state) => ({
          ...state,
          themes: withCustomSorted([...state.themes, created]),
          selectedThemeId: created.id,
          isSaving: false,
        }));
        return true;
      } catch (error) {
        logError('ColorTheme: Failed to save theme as:', error);
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
