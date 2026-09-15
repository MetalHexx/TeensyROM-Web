import { computed } from '@angular/core';
import { DeckState, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** A slot's raw deck state. */
export function deck(store: WritableStore<DjState>) {
  return {
    deck: (slot: Slot) => computed<DeckState>(() => store.decks()[slot]),
  };
}
