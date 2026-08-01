import { computed } from '@angular/core';
import { AudioState } from '../audio-store.state';
import { WritableStore } from '../actions';

/**
 * Selector for checking if any audio devices are available
 */
export function hasDevices(store: WritableStore<AudioState>) {
  return {
    hasDevices: computed<boolean>(() => store.devices().length > 0),
  };
}
