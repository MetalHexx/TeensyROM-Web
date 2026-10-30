import { updateState } from '../../with-devtools';
import { createAction } from '@teensyrom-nx/utils';
import { DeckPanelState, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Merges a patch into one deck's panel, voice strips aside. Logs nothing — it fires on every
 *  drag tick. */
export function setDeckPanel(store: WritableStore<DjState>) {
  return {
    setDeckPanel: ({
      slot,
      patch,
    }: {
      slot: Slot;
      patch: Partial<Omit<DeckPanelState, 'voices'>>;
    }): void => {
      const actionMessage = createAction('set-deck-panel');

      updateState(store, actionMessage, (state) => ({
        panel: { ...state.panel, [slot]: { ...state.panel[slot], ...patch } },
      }));
    },
  };
}
