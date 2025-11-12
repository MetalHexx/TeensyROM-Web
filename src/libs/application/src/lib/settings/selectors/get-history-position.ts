import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

export function getHistoryPosition(store: WritableStore<SettingsState>) {
  return {
    getHistoryPosition: () =>
      computed<number>(() => {
        return store.historyPosition();
      }),
  };
}
