import { computed } from '@angular/core';
import { AudioState } from '../audio-store.state';
import { WritableStore } from '../actions';

/**
 * Selector for checking if there are configured channels
 */
export function hasChannels(store: WritableStore<AudioState>) {
  return {
    hasChannels: computed<boolean>(() => store.channelConfigs().length > 0),
  };
}
