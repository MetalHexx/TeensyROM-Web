import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { IAudioStreamService } from '@teensyrom-nx/domain';
import { AudioState } from '../audio-store.state';
import { WritableStore } from './index';

/**
 * Sets the master output volume level.
 * Clamps to 0–1 range. Auto-unmutes when volume > 0, auto-mutes when volume === 0.
 * Does not overwrite preMuteVolume when setting volume to 0.
 */
export function setMasterVolume(store: WritableStore<AudioState>, audioService: IAudioStreamService) {
  return {
    setMasterVolume: (volume: number): void => {
      const actionMessage = createAction('set-master-volume');
      const clampedVolume = Math.max(0, Math.min(1, volume));

      logInfo(LogType.Info, 'AudioStore: Setting master volume', {
        requestedVolume: volume,
        clampedVolume,
        actionMessage,
      });

      audioService.setMasterVolume(clampedVolume);

      if (clampedVolume > 0) {
        updateState(store, actionMessage, (state) => ({
          ...state,
          masterVolume: clampedVolume,
          isMuted: false,
          preMuteVolume: clampedVolume,
        }));
      } else {
        updateState(store, actionMessage, (state) => ({
          ...state,
          masterVolume: 0,
          isMuted: true,
        }));
      }
    },
  };
}
