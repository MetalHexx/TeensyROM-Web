import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { PlayerFilterType } from '@teensyrom-nx/domain';
import { PlayerState } from '../player-store';
import { WritableStore, ensurePlayerState } from '../player-helpers';

export interface InitializePlayerParams {
  deviceId: string;
  defaultFilter?: PlayerFilterType;
  playTimerEnabled?: boolean;
}

export function initializePlayer(store: WritableStore<PlayerState>) {
  return {
    initializePlayer: ({ deviceId, defaultFilter, playTimerEnabled }: InitializePlayerParams): void => {
      logInfo(LogType.Start, `PlayerAction: Initializing player for device ${deviceId}`);

      const actionMessage = createAction('initialize-player');
      ensurePlayerState(store, deviceId, actionMessage, defaultFilter, playTimerEnabled);

      logInfo(
        LogType.Success,
        `PlayerAction: Player initialized successfully for device ${deviceId}`
      );
    },
  };
}
