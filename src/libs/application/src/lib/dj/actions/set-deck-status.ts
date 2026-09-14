import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DeckStatus, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Sets a deck's transport status. `error` is cleared to `null` unless a value is given. */
export function setDeckStatus(store: WritableStore<DjState>) {
  return {
    setDeckStatus: ({
      slot,
      status,
      error = null,
    }: {
      slot: Slot;
      status: DeckStatus;
      error?: string | null;
    }): void => {
      const actionMessage = createAction('set-deck-status');

      logInfo(LogType.Info, `Deck ${slot} status -> ${status}`);

      updateState(store, actionMessage, (state) => ({
        decks: {
          ...state.decks,
          [slot]: { ...state.decks[slot], status, error },
        },
      }));
    },
  };
}
