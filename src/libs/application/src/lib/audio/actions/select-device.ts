import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { AudioState } from '../audio-store.state';
import { WritableStore } from './index';

/**
 * Selects an audio device by index
 */
export function selectDevice(store: WritableStore<AudioState>) {
  return {
    selectDevice: (deviceIndex: number): void => {
      const actionMessage = createAction('select-device');

      logInfo(LogType.Start, 'AudioStore: Selecting audio device', {
        deviceIndex,
        actionMessage,
      });

      updateState(store, actionMessage, (state) => ({
        ...state,
        selectedDeviceIndex: deviceIndex,
      }));

      logInfo(LogType.Finish, 'AudioStore: Audio device selected');
    },
  };
}
