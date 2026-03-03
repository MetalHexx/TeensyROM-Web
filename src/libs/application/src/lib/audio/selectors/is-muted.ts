import { computed } from '@angular/core';
import { AudioState } from '../audio-store.state';
import { WritableStore } from '../actions';

/**
 * Selector for checking if audio output is currently muted
 */
export function isMuted(store: WritableStore<AudioState>) {
  return {
    isMuted: computed<boolean>(() => store.isMuted()),
  };
}
