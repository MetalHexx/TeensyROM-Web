import { StorageState } from '../storage-store';
import { WritableStore } from '../storage-helpers';
import { createAction } from '@teensyrom-nx/utils';
import { updateState } from '@angular-architects/ngrx-toolkit';

/**
 * Releases the navigation pin for `deviceId`. Only clears when this device currently holds it,
 * so a view whose target changed or that is tearing down after another view took the pin cannot
 * clear someone else's pin.
 */
export function clearNavigationPin(store: WritableStore<StorageState>) {
  return {
    clearNavigationPin: ({ deviceId }: { deviceId: string }): void => {
      const actionMessage = createAction('clear-navigation-pin');

      updateState(store, actionMessage, (state) =>
        state.navigationPin === deviceId ? { navigationPin: null } : state
      );
    },
  };
}
