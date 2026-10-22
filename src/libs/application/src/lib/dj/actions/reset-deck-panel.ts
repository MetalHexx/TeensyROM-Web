import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DjState, HOME_DECK_PANEL, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Returns a deck's whole panel to home. A tune change also clears the deck's detected key, which
 *  belonged to the tune that is going away; a panic leaves it. */
export function resetDeckPanel(store: WritableStore<DjState>) {
  return {
    resetDeckPanel: ({ slot, reason }: { slot: Slot; reason: 'panic' | 'tune-change' }): void => {
      const actionMessage = createAction('reset-deck-panel');

      logInfo(
        LogType.Info,
        `Deck ${slot} panel reset (${reason === 'panic' ? 'panic' : 'tune change'})`
      );

      updateState(store, actionMessage, (state) => ({
        panel: { ...state.panel, [slot]: HOME_DECK_PANEL },
        ...(reason === 'tune-change'
          ? { decks: { ...state.decks, [slot]: { ...state.decks[slot], detectedKey: null } } }
          : {}),
      }));
    },
  };
}
