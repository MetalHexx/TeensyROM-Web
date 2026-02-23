import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { IAudioStreamService } from '@teensyrom-nx/domain';
import { AudioState } from '../audio-store.state';
import { WritableStore } from './index';

/**
 * Sets the volume for a specific channel.
 * Updates the local store state and delegates to the audio stream service.
 */
export function setChannelVolume(store: WritableStore<AudioState>, audioService: IAudioStreamService) {
  return {
    setChannelVolume: (channelIndex: number, volume: number): void => {
      const actionMessage = createAction('set-channel-volume');
      const clampedVolume = Math.max(0, Math.min(1, volume));

      logInfo(LogType.Info, 'AudioStore: Setting channel volume', {
        channelIndex,
        volume: clampedVolume,
        actionMessage,
      });

      // Delegate to service for actual audio processing
      audioService.setChannelVolume(channelIndex, clampedVolume);

      // Update local state for reactive UI
      const currentVolumes = store.channelVolumes();
      const newVolumes = new Map(currentVolumes);
      newVolumes.set(channelIndex, clampedVolume);

      updateState(store, actionMessage, (state) => ({
        ...state,
        channelVolumes: newVolumes,
      }));
    },
  };
}
