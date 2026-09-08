import { logWarn } from '@teensyrom-nx/utils';

/** Namespaces a deck's persisted repeat-track preference under its own key, mirroring
 *  `DeckMidiBinding`'s own per-deck storage key — two decks toggling independently must never share
 *  one preference or overwrite each other's stored value. */
function storageKeyFor(deckId: string): string {
  return `asid-dj-0.deck-${deckId}.repeat-track`;
}

/**
 * Reads deck `deckId`'s persisted repeat-track preference: true when nothing is stored (or the read
 * throws) — a track plays forever until the operator turns repeat off, not the other way round.
 *
 * The preference is the application's, not the player's: core holds repeat-track as a value it is
 * handed and persists nothing, so the browser storage it lives in stays on this side of the seam.
 */
export function loadRepeatTrackPreference(deckId: string): boolean {
  try {
    const stored = localStorage.getItem(storageKeyFor(deckId));
    return stored === null ? true : stored === 'true';
  } catch (error) {
    logWarn(
      `DJ deck: could not read deck "${deckId}"'s repeat-track preference from localStorage — ${error}`
    );
    return true;
  }
}

/** Persists the preference under this deck's own namespaced key, never allowed to throw into the
 *  caller — mirrors `DeckMidiBinding.selectPort`'s own try/catch-wrapped write. */
export function saveRepeatTrackPreference(deckId: string, enabled: boolean): void {
  try {
    localStorage.setItem(storageKeyFor(deckId), String(enabled));
  } catch (error) {
    logWarn(
      `DJ deck: could not persist deck "${deckId}"'s repeat-track preference to localStorage — ${error}`
    );
  }
}
