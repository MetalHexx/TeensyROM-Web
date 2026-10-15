import { computed } from '@angular/core';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

export interface DeckBindingSummary {
  /** The bound cartridge's id, whether or not it is currently present. */
  selectedDeviceId: string | null;
  present: boolean;
  placeholder: string;
  enableVisible: boolean;
  enableDisabled: boolean;
  identifyDisabled: boolean;
  errors: readonly string[];
}

/** Web MIDI enumerates zero ports for a granted-but-empty session (no cartridge attached, or the
 *  OS hasn't surfaced it yet) without the service itself treating that as an error. A plugged-in
 *  cartridge re-enumerates on its own — no "re-enable MIDI" click needed. */
const NO_PORTS_FOUND_ERROR =
  'MIDI access was granted, but no output ports were found. Connect the cartridge — it appears here as soon as the browser sees it.';

/**
 * The binding card's display model for one deck, apart from its cartridge list (see
 * `cartridgeOptions`): the current selection, whether that cartridge is present, the placeholder,
 * and the gates on Enable/Identify. Identify needs MIDI access, the cartridge present, and the
 * deck not playing.
 */
export function bindingSummary(store: WritableStore<DjState>) {
  return {
    bindingSummary: (slot: Slot) =>
      computed<DeckBindingSummary>(() => {
        const midi = store.midi();
        const binding = store.bindings()[slot];
        const deck = store.decks()[slot];

        const noPortsFound =
          midi.accessState === 'granted' && midi.ports.length === 0 ? NO_PORTS_FOUND_ERROR : null;

        return {
          selectedDeviceId: binding.device?.id ?? null,
          present: binding.present,
          placeholder: '— select a cartridge —',
          enableVisible: midi.accessState !== 'granted',
          enableDisabled: midi.accessState === 'requesting',
          identifyDisabled: !(
            midi.accessState === 'granted' &&
            binding.present &&
            deck.status !== 'playing'
          ),
          errors: [midi.lastError, noPortsFound, binding.error].filter(
            (error): error is string => error !== null
          ),
        };
      }),
  };
}
