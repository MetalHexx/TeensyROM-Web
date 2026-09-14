import type { Slot } from '@teensyrom-nx/application';

/** One of the DJ view's two fixed deck columns — always A and B, never derived from device
 *  count or enabled-device order. */
export interface DeckRef {
  readonly slot: Slot;
  readonly letter: string; // mirrors slot — 'A' or 'B'
  readonly index: number; // position in the fixed two-slot list; drives grid-area names
}
