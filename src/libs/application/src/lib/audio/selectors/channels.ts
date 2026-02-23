import { computed } from '@angular/core';
import { ChannelConfig } from '@teensyrom-nx/domain';
import { AudioState } from '../audio-store.state';
import { WritableStore } from '../actions';

/**
 * Selector for accessing channel configurations
 */
export function channels(store: WritableStore<AudioState>) {
  return {
    channels: computed<ChannelConfig[]>(() => store.channelConfigs()),
  };
}
