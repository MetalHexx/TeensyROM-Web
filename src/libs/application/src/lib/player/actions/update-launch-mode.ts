import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, LogType, logInfo, logError } from '@teensyrom-nx/utils';
import { WritableStore, ensurePlayerState } from '../player-helpers';
import { PlayerState } from '../player-store';
import { LaunchMode } from '@teensyrom-nx/domain';
import { IPlayerStorage } from '../player-storage.interface';

export function updateLaunchMode(store: WritableStore<PlayerState>, playerStorage: IPlayerStorage) {
  return {
    updateLaunchMode: ({
      deviceId,
      launchMode,
    }: {
      deviceId: string;
      launchMode: LaunchMode;
    }): void => {
      const actionMessage = createAction('update-launch-mode');

      logInfo(
        LogType.Start,
        `PlayerAction: Updating launch mode for device ${deviceId} to ${launchMode}`
      );

      // Ensure player state exists
      ensurePlayerState(store, deviceId, actionMessage);

      // Update launch mode
      updateState(store, actionMessage, (state) => {
        const currentPlayer = state.players[deviceId];
        if (!currentPlayer) {
          return state;
        }

        return {
          players: {
            ...state.players,
            [deviceId]: {
              ...currentPlayer,
              launchMode,
              lastUpdated: Date.now(),
            },
          },
        };
      });

      // Persist state after launch mode change
      try {
        playerStorage.save(deviceId, store.players()[deviceId]);
      } catch (error) {
        logError(
          `PlayerAction: Failed to persist player state to localStorage for device ${deviceId}`,
          { error }
        );
      }

      logInfo(
        LogType.Success,
        `PlayerAction: Launch mode updated to ${launchMode} for device ${deviceId}`
      );
    },
  };
}
