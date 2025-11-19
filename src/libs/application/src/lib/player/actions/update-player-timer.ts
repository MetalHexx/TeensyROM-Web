import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { PlayerState } from '../player-store';
import { WritableStore } from '../player-helpers';

/**
 * Update custom play timer configuration for a device.
 *
 * This action updates the playTimerConfig in the PlayerStore for a specific device.
 * Used to enable/disable custom timers and set custom duration values.
 *
 * Custom Timer Priority:
 * - When enabled: Custom duration overrides file metadata for ALL file types (except .Hex)
 * - When disabled: Music files use metadata, games/images have no timer (existing behavior)
 *
 * @param store - Player store instance
 * @returns Action method object
 */
export function updatePlayerTimer(store: WritableStore<PlayerState>) {
  return {
    updatePlayerTimer: ({
      deviceId,
      enabled,
      durationMs,
    }: {
      deviceId: string;
      enabled: boolean;
      durationMs: number;
    }): void => {
      const actionMessage = createAction('update-player-timer');

      logInfo(
        LogType.Info,
        `Updating custom timer for device ${deviceId}: enabled=${enabled}, duration=${durationMs}ms`
      );

      updateState(store, actionMessage, (state) => {
        const deviceState = state.players[deviceId];
        if (!deviceState) {
          logInfo(
            LogType.Warning,
            `Cannot update timer config - device ${deviceId} not found`
          );
          return state;
        }

        return {
          players: {
            ...state.players,
            [deviceId]: {
              ...deviceState,
              playTimerConfig: {
                enabled,
                durationMs,
              },
              lastUpdated: Date.now(),
            },
          },
        };
      });

      logInfo(
        LogType.Success,
        `Custom timer config updated for device ${deviceId}`
      );
    },
  };
}
