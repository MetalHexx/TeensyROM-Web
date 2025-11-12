import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

export function canUndo(store: WritableStore<SettingsState>) {
  return {
    canUndo: () =>
      computed(() => {
        const history = store.history();

        if (!history || history.length === 0) {
          return false;
        }

        return true;
      }),
  };
}
