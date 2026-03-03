import { computed } from '@angular/core';
import { AudioState } from '../audio-store.state';
import { WritableStore } from '../actions';

/**
 * Selector for the current master volume level (0–1)
 */
export function masterVolume(store: WritableStore<AudioState>) {
  return {
    masterVolume: computed<number>(() => store.masterVolume()),
  };
}
