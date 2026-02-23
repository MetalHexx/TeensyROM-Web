import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { ChannelConfig } from '@teensyrom-nx/domain';
import { AudioState } from '../audio-store.state';
import { WritableStore } from './index';

/**
 * Loads channel configurations from device audio settings into the store.
 * Called when starting a stream to populate channel state.
 */
export function loadChannelConfigs(store: WritableStore<AudioState>) {
  return {
    loadChannelConfigs: (configs: ChannelConfig[]): void => {
      const actionMessage = createAction('load-channel-configs');

      logInfo(LogType.Info, 'AudioStore: Loading channel configurations', {
        channelCount: configs.length,
        actionMessage,
      });

      updateState(store, actionMessage, (state) => ({
        ...state,
        channelConfigs: configs,
      }));
    },
  };
}
