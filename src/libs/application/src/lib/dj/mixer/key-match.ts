/** How well two decks' keys fit: by the notes their scales share, or `'none'` while either deck
 *  has no detected key. */
export type KeyMatchState = 'full' | 'close' | 'possible' | 'clash' | 'none';

/** The state for a count of shared scale notes (0-7): 7 is `full`, 6 `close`, 5 `possible`, and
 *  4 or fewer a `clash`. */
export function keyMatchStateFor(sharedNotes: number): Exclude<KeyMatchState, 'none'> {
  if (sharedNotes >= 7) return 'full';
  if (sharedNotes === 6) return 'close';
  if (sharedNotes === 5) return 'possible';
  return 'clash';
}
