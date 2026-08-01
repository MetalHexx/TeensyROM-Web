import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { AudioStreamState, IAudioStreamService } from '@teensyrom-nx/domain';
import { AudioState } from '../audio-store.state';
import { WritableStore } from './index';

/**
 * Starts audio streaming for the specified TeensyROM device
 */
export function startStream(store: WritableStore<AudioState>, audioService: IAudioStreamService) {
  return {
    startStream: async (deviceId: string): Promise<void> => {
      const actionMessage = createAction('start-stream');

      const currentState = store.streamState();
      const selectedIndex = store.selectedDeviceIndex();

      // Prevent double-start
      if (currentState === AudioStreamState.Connecting || currentState === AudioStreamState.Streaming) {
        logInfo(LogType.Info, 'AudioStore: Stream already active or connecting');
        return;
      }

      // Check if device is selected
      if (selectedIndex === null) {
        const errorMsg = 'No audio device selected';
        logError('AudioStore: Cannot start stream - no device selected');
        updateState(store, actionMessage, (state) => ({
          ...state,
          error: errorMsg,
          streamState: AudioStreamState.Error,
        }));
        return;
      }

      logInfo(LogType.Start, 'AudioStore: Starting audio stream', {
        deviceId,
        deviceIndex: selectedIndex,
        actionMessage,
      });

      // Transition to connecting state (clears previous error)
      updateState(store, actionMessage, (state) => ({
        ...state,
        streamState: AudioStreamState.Connecting,
        error: null,
      }));

      try {
        await audioService.connect(deviceId);

        logInfo(LogType.Success, 'AudioStore: Audio stream started successfully');

        updateState(store, actionMessage, (state) => ({
          ...state,
          streamState: AudioStreamState.Streaming,
          error: null,
        }));

        logInfo(LogType.Finish, 'AudioStore: Stream start completed');
      } catch (error) {
        const errorMessage = (error as Error)?.message || 'Failed to start audio stream';
        logError('AudioStore: Failed to start audio stream:', error);

        updateState(store, actionMessage, (state) => ({
          ...state,
          streamState: AudioStreamState.Error,
          error: errorMessage,
        }));
      }
    },
  };
}
