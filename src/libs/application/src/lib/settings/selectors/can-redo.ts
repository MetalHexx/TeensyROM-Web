import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

export function canRedo(store: WritableStore<SettingsState>) {
  return {
    canRedo: () =>
      computed(() => {
        const history = store.history();
        const position = store.historyPosition();

        if (!history || history.length === 0) {
          return false;
        }

        return position !== -1;
      }),
  };
}
