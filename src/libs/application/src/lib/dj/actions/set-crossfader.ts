import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction } from '@teensyrom-nx/utils';
import { DjState, WritableStore } from '../dj-store';

/** Sets the crossfader position: −1 hard A … +1 hard B. Logs nothing — it fires on every drag
 *  tick. */
export function setCrossfader(store: WritableStore<DjState>) {
  return {
    setCrossfader: ({ position }: { position: number }): void => {
      const actionMessage = createAction('set-crossfader');

      updateState(store, actionMessage, () => ({ crossfader: position }));
    },
  };
}
