import { computed } from '@angular/core';
import { DeckBindingState, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** A slot's raw MIDI port and device binding state. */
export function binding(store: WritableStore<DjState>) {
  return {
    binding: (slot: Slot) => computed<DeckBindingState>(() => store.bindings()[slot]),
  };
}
