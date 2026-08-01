import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { AudioStreamState, IAudioStreamService } from '@teensyrom-nx/domain';
import { AudioState } from '../audio-store.state';
import { WritableStore } from './index';

/**
 * Stops the current audio stream and resets channel state
 */
export function stopStream(store: WritableStore<AudioState>, audioService: IAudioStreamService) {
  return {
    stopStream: async (): Promise<void> => {
      const actionMessage = createAction('stop-stream');

      const currentState = store.streamState();

      // No-op if already disconnected
      if (currentState === AudioStreamState.Disconnected) {
        logInfo(LogType.Info, 'AudioStore: Stream already disconnected');
        return;
      }

      logInfo(LogType.Start, 'AudioStore: Stopping audio stream', { actionMessage });

      try {
        await audioService.disconnect();

        logInfo(LogType.Success, 'AudioStore: Audio stream stopped successfully');

        // Reset stream state and channel state
        updateState(store, actionMessage, (state) => ({
          ...state,
          streamState: AudioStreamState.Disconnected,
          error: null,
          channelConfigs: [],
          channelVolumes: new Map(),
        }));

        logInfo(LogType.Finish, 'AudioStore: Stream stop completed');
      } catch (error) {
        const errorMessage = (error as Error)?.message || 'Failed to stop audio stream';
        logError('AudioStore: Failed to stop audio stream:', error);

        // Still set to disconnected even on error - stream is likely dead
        // Also reset channel state
        updateState(store, actionMessage, (state) => ({
          ...state,
          streamState: AudioStreamState.Disconnected,
          error: errorMessage,
          channelConfigs: [],
          channelVolumes: new Map(),
        }));
      }
    },
  };
}
