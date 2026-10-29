import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction } from '@teensyrom-nx/utils';
import { ColorThemeActionStore } from './action-store';

export function selectTheme(store: ColorThemeActionStore) {
  return {
    /** Selects a theme and copies its colors into the draft. Nothing is sent to a device. */
    selectTheme: (themeId: string): void => {
      const theme = store.themes().find((t) => t.id === themeId);
      if (!theme) {
        return;
      }
      updateState(store, createAction('select-color-theme'), (state) => ({
        ...state,
        selectedThemeId: theme.id,
        draft: { ...theme.parts.device },
      }));
    },
  };
}
