import { computed } from '@angular/core';
import { AudioStreamState } from '@teensyrom-nx/domain';
import { AudioState } from '../audio-store.state';
import { WritableStore } from '../actions';

/**
 * Selector for checking if audio is connecting
 */
export function isConnecting(store: WritableStore<AudioState>) {
  return {
    isConnecting: computed<boolean>(() => store.streamState() === AudioStreamState.Connecting),
  };
}
