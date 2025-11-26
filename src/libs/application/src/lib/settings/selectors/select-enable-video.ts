import { computed } from '@angular/core';
import { WritableStore } from '../actions';
import { SettingsState } from '../settings-state.interface';

/**
 * Selector for enableVideo flag
 * Returns false if settings or video settings haven't loaded yet
 */
export function selectEnableVideo(store: WritableStore<SettingsState>) {
  return {
    enableVideo: computed(() => store.settings()?.videoSettings?.enableVideo ?? false),
  };
}
