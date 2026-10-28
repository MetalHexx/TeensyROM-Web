import { updateState } from '@angular-architects/ngrx-toolkit';
import { createAction, logInfo, LogType } from '@teensyrom-nx/utils';
import { DeckHolding, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** Records the set row a deck holds; null when it holds none. */
export function setDeckHolding(store: WritableStore<DjState>) {
  return {
    setDeckHolding: ({ slot, holding }: { slot: Slot; holding: DeckHolding | null }): void => {
      const actionMessage = createAction('set-deck-holding');

      logInfo(
        LogType.Info,
        holding === null
          ? `Deck ${slot} holds no row`
          : `Deck ${slot} holds row ${holding.rowId} of set ${holding.setId}`
      );

      updateState(store, actionMessage, (state) => ({
        sets: { ...state.sets, holdings: { ...state.sets.holdings, [slot]: holding } },
      }));
    },
  };
}
