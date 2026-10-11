import type { LoopsCuesPanelModel } from '@teensyrom-nx/ui/components';
import type { DeckRef } from '../deck-ref';

/**
 * Everything one deck column needs to render the panel that stays inert — Loops/Cues. Transport,
 * the binding card, the mixer strip, Voice and Speed are wired live from `DjStore` (see
 * `DjDeckColumnComponent` and `DjMixerCardComponent`) and no longer come from here.
 */
export interface DeckPlaceholderModels {
  readonly loopsCues: LoopsCuesPanelModel;
}

/**
 * Builds the resting-state models for one deck. Every accessible name is built with
 * `deck ${letter}`.
 */
export function createDeckPlaceholders(deck: DeckRef): DeckPlaceholderModels {
  const { letter } = deck;

  const loopsCues: LoopsCuesPanelModel = {
    accessibleName: `Loops/Cues deck ${letter}`,
    addAccessibleName: `Add marker deck ${letter}`,
    stopAccessibleName: `Stop loop deck ${letter}`,
    rows: [],
  };

  return {
    loopsCues,
  };
}
