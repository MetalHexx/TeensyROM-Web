import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, LogType, logInfo, logError } from '@teensyrom-nx/utils';
import { WritableStore, ensurePlayerState } from '../player-helpers';
import { PlayerState, ShuffleSettings } from '../player-store';
import { IPlayerStorage } from '../player-storage.interface';

export function updateShuffleSettings(store: WritableStore<PlayerState>, playerStorage: IPlayerStorage) {
  return {
    updateShuffleSettings: ({
      deviceId,
      shuffleSettings,
    }: {
      deviceId: string;
      shuffleSettings: Partial<ShuffleSettings>;
    }): void => {
      const actionMessage = createAction('update-shuffle-settings');

      logInfo(
        LogType.Start,
        `PlayerAction: Updating shuffle settings for device ${deviceId}`,
        shuffleSettings
      );

      // Ensure player state exists
      ensurePlayerState(store, deviceId, actionMessage);

      // Update shuffle settings
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
              shuffleSettings: {
                ...currentPlayer.shuffleSettings,
                ...shuffleSettings,
              },
              lastUpdated: Date.now(),
            },
          },
        };
      });

      // Persist state after shuffle settings change
      try {
        playerStorage.save(deviceId, store.players()[deviceId]);
      } catch (error) {
        logError(
          `PlayerAction: Failed to persist player state to localStorage for device ${deviceId}`,
          { error }
        );
      }

      logInfo(LogType.Success, `PlayerAction: Shuffle settings updated for device ${deviceId}`);
    },
  };
}
