import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { PlayerState } from '../player-store';
import { WritableStore, getPlayerState } from '../player-helpers';
import { IPlayerStorage } from '../player-storage.interface';

export interface ClearHistoryParams {
  deviceId: string;
}

export function clearHistory(store: WritableStore<PlayerState>, playerStorage: IPlayerStorage) {
  return {
    clearHistory: ({ deviceId }: ClearHistoryParams): void => {
      const actionMessage = createAction('clear-history');

      logInfo(LogType.Start, `ClearHistory: Clearing history for device ${deviceId}`);

      const playerState = getPlayerState(store, deviceId);

      if (!playerState) {
        logInfo(
          LogType.Info,
          `ClearHistory: No player state for device ${deviceId}, nothing to clear`
        );
        return;
      }

      if (!playerState.playHistory) {
        logInfo(LogType.Info, `ClearHistory: History already null for device ${deviceId}`);
        return;
      }

      updateState(store, actionMessage, (state) => {
        const player = state.players[deviceId];
        if (!player) {
          return state;
        }

        logInfo(
          LogType.Success,
          `ClearHistory: History cleared successfully for device ${deviceId}`
        );

        return {
          players: {
            ...state.players,
            [deviceId]: {
              ...player,
              playHistory: null,
            },
          },
        };
      });

      // Persist state after clearing history
      try {
        playerStorage.save(deviceId, store.players()[deviceId]);
      } catch (error) {
        logError('Failed to persist player state to localStorage', { deviceId, error });
      }
    },
  };
}
