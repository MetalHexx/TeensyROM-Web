import { computed } from '@angular/core';
import { PlayerState } from '../player-store';
import { WritableStore } from '../player-helpers';

export function isPlayerStopping(store: WritableStore<PlayerState>) {
  return {
    isPlayerStopping: (deviceId: string) =>
      computed(() => {
        return store.players()[deviceId]?.isStopping ?? false;
      }),
  };
}
