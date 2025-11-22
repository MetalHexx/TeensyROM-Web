import { inject } from '@angular/core';
import { withMethods } from '@ngrx/signals';
import {
  PLAYER_SERVICE,
  IPlayerService,
  DEVICE_SERVICE,
  IDeviceService,
} from '@teensyrom-nx/domain';
import { PlayerState } from '../player-store';
import { WritableStore } from '../player-helpers';
import { PLAYER_STORAGE, IPlayerStorage } from '../player-storage.interface';
import { initializePlayer } from './initialize-player';
import { launchFileWithContext } from './launch-file-with-context';
import { launchRandomFile } from './launch-random-file';
import { loadFileContext } from './load-file-context';
import { updateShuffleSettings } from './update-shuffle-settings';
import { updateLaunchMode } from './update-launch-mode';
import { updatePlayerStatus } from './update-player-status';
import { play } from './play';
import { pauseMusic } from './pause-music';
import { stopPlayback } from './stop-playback';
import { updateFavoriteStatus } from './update-favorite-status';
import { navigateNext } from './navigate-next';
import { navigatePrevious } from './navigate-previous';
import { removePlayer } from './remove-player';
import { recordHistory } from './record-history';
import { clearHistory } from './clear-history';
import { navigateBackwardInHistory } from './navigate-backward-in-history';
import { navigateForwardInHistory } from './navigate-forward-in-history';
import { updateHistoryViewVisibility } from './update-history-view-visibility';
import { navigateToHistoryPosition } from './navigate-to-history-position';
import { updatePlayerTimer } from './update-player-timer';

export function withPlayerActions() {
  return withMethods(
    (
      store,
      playerService: IPlayerService = inject(PLAYER_SERVICE),
      deviceService: IDeviceService = inject(DEVICE_SERVICE),
      playerStorage: IPlayerStorage = inject(PLAYER_STORAGE)
    ) => {
      const writableStore = store as WritableStore<PlayerState>;
      return {
        ...initializePlayer(writableStore),
        ...launchFileWithContext(writableStore, playerService, playerStorage),
        ...launchRandomFile(writableStore, playerService),
        ...loadFileContext(writableStore),
        ...updateShuffleSettings(writableStore, playerStorage),
        ...updateLaunchMode(writableStore, playerStorage),
        ...updatePlayerStatus(writableStore),
        ...updatePlayerTimer(writableStore, playerStorage),
        ...play(writableStore, playerService),
        ...pauseMusic(writableStore, playerService),
        ...stopPlayback(writableStore, deviceService),
        ...updateFavoriteStatus(writableStore),
        ...navigateNext(writableStore, playerService, playerStorage),
        ...navigatePrevious(writableStore, playerService, playerStorage),
        ...removePlayer(writableStore),
        ...recordHistory(writableStore, playerStorage),
        ...clearHistory(writableStore, playerStorage),
        ...navigateBackwardInHistory(writableStore, playerService, playerStorage),
        ...navigateForwardInHistory(writableStore, playerService, playerStorage),
        updateHistoryViewVisibility: (params: { deviceId: string; visible: boolean }) =>
          updateHistoryViewVisibility(writableStore, playerStorage, params),
        ...navigateToHistoryPosition(writableStore, playerService, playerStorage),
      };
    }
  );
}
