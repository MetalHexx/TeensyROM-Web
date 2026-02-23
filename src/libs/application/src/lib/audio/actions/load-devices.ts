import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { IAudioStreamService } from '@teensyrom-nx/domain';
import { AudioState } from '../audio-store.state';
import { WritableStore } from './index';

/**
 * Loads available audio input devices from the host system
 */
export function loadDevices(store: WritableStore<AudioState>, audioService: IAudioStreamService) {
  return {
    loadDevices: async (): Promise<void> => {
      const actionMessage = createAction('load-devices');

      logInfo(LogType.Start, 'AudioStore: Loading audio devices', { actionMessage });

      updateState(store, actionMessage, (state) => ({
        ...state,
        isLoading: true,
        error: null,
      }));

      try {
        const devices = await audioService.getDevices();

        logInfo(LogType.Success, 'AudioStore: Audio devices loaded', {
          deviceCount: devices.length,
        });

        updateState(store, actionMessage, (state) => ({
          ...state,
          devices,
          isLoading: false,
          error: devices.length === 0 ? 'No audio devices found' : null,
        }));

        logInfo(LogType.Finish, 'AudioStore: Device loading completed');
      } catch (error) {
        const errorMessage = (error as Error)?.message || 'Failed to load audio devices';
        logError('AudioStore: Failed to load audio devices:', error);

        updateState(store, actionMessage, (state) => ({
          ...state,
          devices: [],
          isLoading: false,
          error: errorMessage,
        }));
      }
    },
  };
}
