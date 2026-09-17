import { computed } from '@angular/core';
import { DeckBindingState, DjState, WritableStore } from '../dj-store';
import { otherSlot, type Slot } from '../slot';
import type { MidiAccessState } from '../ports/midi-access';

export interface BindingOption {
  id: string;
  label: string;
  takenBy: Slot | null;
}

export interface DeckBindingSummary {
  portOptions: readonly BindingOption[];
  selectedPortId: string | null;
  portPlaceholder: string;
  portsEnabled: boolean;
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

/** After a reload and before the Enable gesture, every stored port is absent — the name is the
 *  whole point of remembering it, so the last-saw placeholder wins regardless of access state. */
function portPlaceholderFor(binding: DeckBindingState, accessState: MidiAccessState): string {
  if (binding.port && !binding.portPresent) return `— last saw ${binding.port.name} —`;
  return accessState === 'granted' ? '— select a port —' : '— MIDI not enabled —';
}

/**
 * The binding card's whole display model for one deck: the port option list (with which slot, if
 * any, already holds each one), the current selection, placeholder, and the gates on
 * Enable/Identify.
 */
export function bindingSummary(store: WritableStore<DjState>) {
  return {
    bindingSummary: (slot: Slot) =>
      computed<DeckBindingSummary>(() => {
        const other = otherSlot(slot);
        const midi = store.midi();
        const bindings = store.bindings();
        const binding = bindings[slot];
        const otherBinding = bindings[other];
        const deck = store.decks()[slot];

        const portOptions: BindingOption[] = midi.ports.map((port) => ({
          id: port.id,
          label: `${port.name} (${port.manufacturer})`,
          takenBy: otherBinding.port?.id === port.id ? other : null,
        }));

        const selectedPortId = binding.portPresent ? (binding.port?.id ?? null) : null;

        const noPortsFound =
          midi.accessState === 'granted' && midi.ports.length === 0 ? NO_PORTS_FOUND_ERROR : null;

        return {
          portOptions,
          selectedPortId,
          portPlaceholder: portPlaceholderFor(binding, midi.accessState),
          portsEnabled: midi.accessState === 'granted',
          enableVisible: midi.accessState !== 'granted',
          enableDisabled: midi.accessState === 'requesting',
          identifyDisabled: !(
            midi.accessState === 'granted' &&
            selectedPortId !== null &&
            deck.status !== 'playing'
          ),
          errors: [midi.lastError, noPortsFound, binding.error].filter(
            (error): error is string => error !== null
          ),
        };
      }),
  };
}
