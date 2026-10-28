import { withMethods } from '@ngrx/signals';
import { DjState, WritableStore } from '../dj-store';
import { deck } from './deck';
import { binding } from './binding';
import { transportSummary } from './transport-summary';
import { bindingSummary } from './binding-summary';
import { canShape, deckPanel, keyMatch, keyReadout } from './mixer';
import { deckLoops } from './deck-loops';
import { loopsSummary } from './loops-summary';
import { loopLapPercent } from './loop-lap';
import { settingsInPlay } from './settings-in-play';
import { deckHolding, deckSetSummary, setCardSummary, setTreeSummary } from './sets';

export function withDjSelectors() {
  return withMethods((store) => {
    const writableStore = store as WritableStore<DjState>;
    return {
      ...deck(writableStore),
      ...binding(writableStore),
      ...transportSummary(writableStore),
      ...bindingSummary(writableStore),
      ...deckPanel(writableStore),
      ...canShape(writableStore),
      ...keyReadout(writableStore),
      ...keyMatch(writableStore),
      ...deckLoops(writableStore),
      ...loopsSummary(writableStore),
      ...loopLapPercent(writableStore),
      ...settingsInPlay(writableStore),
      ...setCardSummary(writableStore),
      ...setTreeSummary(writableStore),
      ...deckHolding(writableStore),
      ...deckSetSummary(writableStore),
    };
  });
}
