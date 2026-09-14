import type {
  DeckStripModel,
  LoopsCuesPanelModel,
  SpeedPanelModel,
  VoicePanelModel,
} from '@teensyrom-nx/ui/components';
import type { DeckRef } from '../deck-ref';

/**
 * Everything one deck column and its mixer strip need to render the panels that stay inert —
 * Voice, Speed, Loops/Cues and the mixer strip. Transport and the binding card are wired live
 * from `DjStore` (see `DjDeckColumnComponent`) and no longer come from here.
 */
export interface DeckPlaceholderModels {
  readonly voice: VoicePanelModel;
  readonly speed: SpeedPanelModel;
  readonly loopsCues: LoopsCuesPanelModel;
  readonly strip: DeckStripModel;
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

  const strip: DeckStripModel = {
    filter: {
      engaged: 'lowPass',
      groupAccessibleName: `Filter mode deck ${letter}`,
      optionAccessibleNames: {
        lowPass: `Filter mode low-pass deck ${letter}`,
        bandPass: `Filter mode band-pass deck ${letter}`,
        highPass: `Filter mode high-pass deck ${letter}`,
        off: `Filter mode off deck ${letter}`,
      },
    },
    knobs: [
      { id: 'cutoff', label: 'Cutoff', accessibleName: `Cutoff deck ${letter}`, value: 0 },
      { id: 'resonance', label: 'Resonance', accessibleName: `Resonance deck ${letter}`, value: 0 },
      {
        id: 'pulseWidth',
        label: 'Pulse width',
        accessibleName: `Pulse width deck ${letter}`,
        value: 0,
      },
      { id: 'key', label: 'Key', accessibleName: `Key deck ${letter}`, value: 0, readout: null },
    ],
    fader: { value: 1, label: letter, accessibleName: `Gain deck ${letter}` },
  };

  return {
    voice,
    speed,
    loopsCues,
    strip,
  };
}
