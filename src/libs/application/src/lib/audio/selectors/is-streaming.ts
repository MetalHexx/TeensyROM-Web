import { computed } from '@angular/core';
import { AudioStreamState } from '@teensyrom-nx/domain';
import { AudioState } from '../audio-store.state';
import { WritableStore } from '../actions';

/**
 * Selector for checking if audio is currently streaming
 */
export function isStreaming(store: WritableStore<AudioState>) {
  return {
    isStreaming: computed<boolean>(() => store.streamState() === AudioStreamState.Streaming),
  };
}
