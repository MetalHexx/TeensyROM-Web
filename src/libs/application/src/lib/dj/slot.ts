/** A deck slot. The DJ view runs exactly two decks, A and B. */
export type Slot = 'A' | 'B';

export const DECK_SLOTS: readonly Slot[] = ['A', 'B'];

/** The deck a slot is not — used to address "the other deck" without a lookup table. */
export function otherSlot(slot: Slot): Slot {
  return slot === 'A' ? 'B' : 'A';
}
