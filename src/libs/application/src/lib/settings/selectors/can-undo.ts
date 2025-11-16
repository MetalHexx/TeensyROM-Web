import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

export function canUndo(store: WritableStore<SettingsState>) {
  return {
    canUndo: () =>
      computed(() => {
        const history = store.history();
        const position = store.historyPosition();

        if (!history || history.length === 0) {
          return false;
        }

        // Can undo if:
        // - At current state (-1) and history exists
        // - At any position > 0 (can move backward)
        return position === -1 || position > 0;
      }),
  };
}
