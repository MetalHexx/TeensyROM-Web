/** One deck's identity: a stable id namespacing its own storage keys, and a label for its own UI. */
export interface DeckDescriptor {
  readonly id: string;
  readonly label: string;
}

/** The composed decks. Adding an entry composes another fully-independent deck; nothing else
 *  changes — `DeckHostComponent` provides a whole deck's collaborators per entry, and every
 *  page-level surface reaches a deck only through `DeckRegistry`. */
export const DECKS: readonly DeckDescriptor[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
];
