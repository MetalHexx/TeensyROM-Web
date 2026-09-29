import { updateState } from '@angular-architects/ngrx-toolkit';
import { firstValueFrom } from 'rxjs';
import { PlayerStatus, IDeviceService } from '@teensyrom-nx/domain';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { PlayerState } from '../player-store';
import { WritableStore } from '../player-helpers';

export function stopPlayback(store: WritableStore<PlayerState>, deviceService: IDeviceService) {
  return {
    stopPlayback: async ({ deviceId }: { deviceId: string }): Promise<void> => {
      const actionMessage = createAction('stop-playback');

      logInfo(LogType.Start, `Stopping playback for ${deviceId}`, { deviceId, actionMessage });

      const statusBeforeStop = store.players()[deviceId]?.status ?? PlayerStatus.Stopped;

      // The reset takes ~15 s on the device; flagged so a second Stop can't queue another one.
      updateState(store, actionMessage, (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            isStopping: true,
          },
        },
      }));

      try {
        logInfo(LogType.NetworkRequest, `Calling resetDevice API for ${deviceId}`);
        await firstValueFrom(deviceService.resetDevice(deviceId));

        logInfo(LogType.Success, `Device reset successful for ${deviceId}, status: Stopped`);

        updateState(store, actionMessage, (state) => ({
          players: {
            ...state.players,
            [deviceId]: {
              ...state.players[deviceId],
              status: PlayerStatus.Stopped,
              isStopping: false,
              error: null,
              lastUpdated: Date.now(),
            },
          },
        }));
      } catch (error) {
        const errorMessage = (error as Error)?.message || 'Failed to stop playback';
        logError(`Stop playback failed for ${deviceId}:`, error);

        updateState(store, actionMessage, (state) => ({
          players: {
            ...state.players,
            [deviceId]: {
              ...state.players[deviceId],
              // A failed reset may have left the file running: keep its status so Stop stays
              // available to retry, rather than offering a Play that would relaunch it.
              status: statusBeforeStop,
              isStopping: false,
              error: errorMessage,
              lastUpdated: Date.now(),
            },
          },
        }));
      }
    },
  };
}
