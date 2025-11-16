import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

/**
 * Selector that returns whether the user is actively navigating through history.
 * Returns true when historyPosition !== -1 (not at current state).
 */
export function isNavigatingHistory(store: WritableStore<SettingsState>) {
  return {
    isNavigatingHistory: () =>
      computed<boolean>(() => {
        const position = store.historyPosition();
        return position !== -1;
      }),
  };
}
