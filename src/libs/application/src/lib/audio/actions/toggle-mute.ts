import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { IAudioStreamService } from '@teensyrom-nx/domain';
import { AudioState } from '../audio-store.state';
import { WritableStore } from './index';

/**
 * Toggles the muted state of the audio output.
 * When muting: saves current volume to preMuteVolume, sets volume to 0.
 * When unmuting: restores volume from preMuteVolume.
 */
export function toggleMute(store: WritableStore<AudioState>, audioService: IAudioStreamService) {
  return {
    toggleMute: (): void => {
      const actionMessage = createAction('toggle-mute');
      const currentlyMuted = store.isMuted();

      if (currentlyMuted) {
        const restoreVolume = store.preMuteVolume();

        logInfo(LogType.Info, 'AudioStore: Unmuting, restoring volume', {
          restoreVolume,
          actionMessage,
        });

        audioService.setMasterVolume(restoreVolume);

        updateState(store, actionMessage, (state) => ({
          ...state,
          isMuted: false,
          masterVolume: restoreVolume,
        }));
      } else {
        const currentVolume = store.masterVolume();

        logInfo(LogType.Info, 'AudioStore: Muting, saving current volume', {
          savedVolume: currentVolume,
          actionMessage,
        });

        audioService.setMasterVolume(0);

        updateState(store, actionMessage, (state) => ({
          ...state,
          isMuted: true,
          masterVolume: 0,
          preMuteVolume: currentVolume,
        }));
      }
    },
  };
}
