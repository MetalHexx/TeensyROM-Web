import { StorageState } from '../storage-store';
import { WritableStore } from '../storage-helpers';
import { createAction } from '@teensyrom-nx/utils';
import { updateState } from '@angular-architects/ngrx-toolkit';

/**
 * Holds the directory list for `deviceId` against playback-driven realignment. A mounted view
 * takes this pin while its rendered position must not move without user intent.
 */
export function setNavigationPin(store: WritableStore<StorageState>) {
  return {
    setNavigationPin: ({ deviceId }: { deviceId: string }): void => {
      const actionMessage = createAction('set-navigation-pin');

      updateState(store, actionMessage, () => ({
        navigationPin: deviceId,
      }));
    },
  };
}
