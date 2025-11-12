import { computed } from '@angular/core';
import { Settings } from '@teensyrom-nx/domain';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

export function getSettings(store: WritableStore<SettingsState>) {
  return {
    getSettings: () =>
      computed<Settings | null>(() => {
        return store.settings();
      }),
  };
}
