import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

/**
 * Selector for video settings
 * Returns null if settings haven't loaded yet
 */
export function selectVideoSettings(store: WritableStore<SettingsState>) {
  return {
    videoSettings: computed(() => store.settings()?.videoSettings ?? null),
  };
}
