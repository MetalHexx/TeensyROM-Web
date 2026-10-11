import type {
  LoopsCuesPanelModel,
  SpeedPanelModel,
  VoicePanelModel,
} from '@teensyrom-nx/ui/components';
import type { DeckRef } from '../deck-ref';

/**
 * Everything one deck column needs to render the panels that stay inert — Voice, Speed and
 * Loops/Cues. Transport, the binding card and the mixer strip are wired live from `DjStore` (see
 * `DjDeckColumnComponent` and `DjMixerCardComponent`) and no longer come from here.
 */
export interface DeckPlaceholderModels {
  readonly voice: VoicePanelModel;
  readonly speed: SpeedPanelModel;
  readonly loopsCues: LoopsCuesPanelModel;
}

const VOICE_ROW_LABELS = ['V1', 'V2', 'V3'] as const;

/**
 * Builds the resting-state models for one deck. Every accessible name is built with
 * `deck ${letter}`, and every id that must stay unique across decks (the voice rows'
 * `checkboxId`) is scoped by that same letter.
 */
export function createDeckPlaceholders(deck: DeckRef): DeckPlaceholderModels {
  const { letter } = deck;

  const voice: VoicePanelModel = {
    accessibleName: `Voice deck ${letter}`,
    rows: VOICE_ROW_LABELS.map((label, i) => {
      const n = i + 1;
      return {
        label,
        muted: false,
        holdLabel: 'Kill',
        checkboxId: `voice-${letter}-${n}`,
        muteAccessibleName: `Mute voice ${n} deck ${letter}`,
        holdAccessibleName: `Kill voice ${n} deck ${letter}`,
      };
    }),
    clearAccessibleName: `Clear all voice mutes deck ${letter}`,
  };

  const speed: SpeedPanelModel = {
    accessibleName: `Speed deck ${letter}`,
    valueText: '1.000x',
    faderValue: 0,
    faderAccessibleName: `Speed multiplier deck ${letter}`,
    min: -1,
    max: 1,
    step: 0.01,
    jumpButtons: [
      { id: 'up', label: '+50%', accessibleName: `Speed up 50% deck ${letter}` },
      { id: 'home', label: 'Home', accessibleName: `Speed home deck ${letter}` },
      { id: 'down', label: '−50%', accessibleName: `Speed down 50% deck ${letter}` },
    ],
  };

  const loopsCues: LoopsCuesPanelModel = {
    accessibleName: `Loops/Cues deck ${letter}`,
    addAccessibleName: `Add marker deck ${letter}`,
    stopAccessibleName: `Stop loop deck ${letter}`,
    rows: [],
  };

  return {
    voice,
    speed,
    loopsCues,
  };
}
