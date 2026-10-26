import type { SettingsInPlaySummary } from '@teensyrom-nx/application';
import type { DeckSettingsSignModel } from '@teensyrom-nx/ui/components/dj';
import type { DeckRef } from './deck-ref';

/** The sign naming whose settings are in play on a deck; the SID panel and the channel strip each
 *  show one, and both come from here so the two agree. */
export function settingsSignModel(
  deck: DeckRef,
  { markerId, name }: SettingsInPlaySummary
): DeckSettingsSignModel {
  return {
    text: name,
    own: markerId !== null,
    accessibleName: `Settings in play deck ${deck.letter}: ${name}`,
  };
}
