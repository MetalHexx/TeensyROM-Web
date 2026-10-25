import { computed } from '@angular/core';
import { DeckLoopsState, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** A slot's raw loop state. */
export function deckLoops(store: WritableStore<DjState>) {
  return {
    deckLoops: (slot: Slot) => computed<DeckLoopsState>(() => store.loops()[slot]),
  };
}
