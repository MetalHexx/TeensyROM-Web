import type { LoopBoundaryModel, LoopsCuesPlateModel } from '@teensyrom-nx/ui/components/dj';
import type { DeckRef } from '../deck-ref';

/**
 * Everything one deck column needs to render the panel that stays inert — Loops/Cues. Transport,
 * the binding card, the SID panel, Voice and Speed are wired live from `DjStore` (see
 * `DjDeckColumnComponent` and `DjSidPanelComponent`) and no longer come from here.
 */
export interface DeckPlaceholderModels {
  readonly loopsCues: LoopsCuesPlateModel;
}

/**
 * Builds the resting-state models for one deck. Every accessible name is built with
 * `deck ${letter}`.
 */
export function createDeckPlaceholders(deck: DeckRef): DeckPlaceholderModels {
  const { letter } = deck;

  const boundary = (tag: 'Start' | 'End'): LoopBoundaryModel => ({
    tag,
    empty: true,
    disabled: true,
    offsetFrames: 0,
    rangeFrames: 0,
    tickPercents: [],
    previousDisabled: true,
    nextDisabled: true,
    nudgeAccessibleName: `Nudge ${tag.toLowerCase()} deck ${letter}`,
    previousAccessibleName: `Snap ${tag.toLowerCase()} to previous moment deck ${letter}`,
    nextAccessibleName: `Snap ${tag.toLowerCase()} to next moment deck ${letter}`,
  });

  const loopsCues: LoopsCuesPlateModel = {
    accessibleName: `Loops/Cues deck ${letter}`,
    addAccessibleName: `Add marker deck ${letter}`,
    stopAccessibleName: `Stop loop deck ${letter}`,
    addDisabled: true,
    stopDisabled: true,
    gridAccessibleName: `Loops and cues, deck ${letter}`,
    emptyText: 'Load a tune to add loops',
    selected: {
      empty: true,
      name: '',
      kindLabel: '',
      spanText: '',
      activity: 'idle',
      ready: true,
      triggerDisabled: true,
      setEndDisabled: true,
      clearEndDisabled: true,
      deleteDisabled: true,
      start: boundary('Start'),
      end: boundary('End'),
      triggerAccessibleName: `Trigger selected loop deck ${letter}`,
      setEndAccessibleName: `Set end of selected loop deck ${letter}`,
      clearEndAccessibleName: `Clear end of selected loop deck ${letter}`,
      deleteAccessibleName: `Delete selected loop deck ${letter}`,
    },
    tiles: [],
  };

  return {
    loopsCues,
  };
}
