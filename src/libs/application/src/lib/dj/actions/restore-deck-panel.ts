import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DeckPanelState, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Replaces one deck's whole panel with a kept one. Unlike a reset it leaves the detected key. */
export function restoreDeckPanel(store: WritableStore<DjState>) {
  return {
    restoreDeckPanel: ({ slot, panel }: { slot: Slot; panel: DeckPanelState }): void => {
      const actionMessage = createAction('restore-deck-panel');

      logInfo(LogType.Info, `Deck ${slot} panel restored`);

      updateState(store, actionMessage, (state) => ({
        panel: { ...state.panel, [slot]: panel },
      }));
    },
  };
}
