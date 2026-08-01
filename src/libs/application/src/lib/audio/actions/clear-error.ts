import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { AudioStreamState } from '@teensyrom-nx/domain';
import { AudioState } from '../audio-store.state';
import { WritableStore } from './index';

/**
 * Clears the current error and resets to disconnected state
 */
export function clearError(store: WritableStore<AudioState>) {
  return {
    clearError: (): void => {
      const actionMessage = createAction('clear-error');

      logInfo(LogType.Start, 'AudioStore: Clearing error', { actionMessage });

      updateState(store, actionMessage, (state) => ({
        ...state,
        streamState: AudioStreamState.Disconnected,
        error: null,
      }));

      logInfo(LogType.Finish, 'AudioStore: Error cleared');
    },
  };
}
