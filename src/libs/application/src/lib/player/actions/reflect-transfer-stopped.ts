import { updateState } from '@angular-architects/ngrx-toolkit';
import { PlayerStatus } from '@teensyrom-nx/domain';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { PlayerState } from '../player-store';
import { WritableStore, ensurePlayerState } from '../player-helpers';

/**
 * Local-only counterpart to `stopPlayback` for devices mid file transfer.
 *
 * The device is already stopped server-side by the transfer pump, so this reflects that in the
 * player state without issuing any device command — a client-issued reset here would be a second
 * command against a device that is already busy and leased.
 */
export function reflectTransferStopped(store: WritableStore<PlayerState>) {
  return {
    reflectTransferStopped: ({ deviceId }: { deviceId: string }): void => {
      const actionMessage = createAction('reflect-transfer-stopped');

      logInfo(LogType.Info, `Reflecting transfer-stopped playback for ${deviceId}`, {
        deviceId,
        actionMessage,
      });

      ensurePlayerState(store, deviceId, actionMessage);

      updateState(store, actionMessage, (state) => ({
        players: {
          ...state.players,
          [deviceId]: {
            ...state.players[deviceId],
            status: PlayerStatus.Stopped,
            error: null,
            lastUpdated: Date.now(),
          },
        },
      }));
    },
  };
}
