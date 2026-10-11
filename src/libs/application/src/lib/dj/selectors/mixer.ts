import { computed } from '@angular/core';
import { DeckMixState, DeckStatus, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';
import { keyDisplayFor } from '../mixer/key-display';

const SHAPEABLE_STATUSES: readonly DeckStatus[] = ['playing', 'paused', 'stopped'];

/** A slot's raw mix state. The crossfader and key display format are read through the state
 *  signals `store.crossfader()` and `store.keyDisplayFormat()`. */
export function deckMix(store: WritableStore<DjState>) {
  return {
    deckMix: (slot: Slot) => computed<DeckMixState>(() => store.mix()[slot]),
  };
}

/** Whether a deck's tune-shaping controls are live: a tune is loaded, no load or subtune switch is
 *  running, and the deck sits at a settled transport status. Deliberately not `busy`, which also
 *  spans the `await` in a play toggle and would dim the controls on every Play press. */
export function canShape(store: WritableStore<DjState>) {
  return {
    canShape: (slot: Slot) =>
      computed<boolean>(() => {
        const deck = store.decks()[slot];
        return deck.loaded !== null && !deck.switching && SHAPEABLE_STATUSES.includes(deck.status);
      }),
  };
}

/** The signed semitone offset shown when no key is detected; negatives use U+2212, matching the
 *  speed jump labels. */
function signedOffset(semitones: number): string {
  if (semitones === 0) return '0';
  return semitones > 0 ? `+${semitones}` : `−${Math.abs(semitones)}`;
}

/** The Key knob's readout: the detected key shifted by the knob's offset in the chosen display
 *  format, or the signed offset itself when no key is detected. */
export function keyReadout(store: WritableStore<DjState>) {
  return {
    keyReadout: (slot: Slot) =>
      computed<string>(() => {
        const { keySemitones } = store.mix()[slot];
        const key = keyDisplayFor(
          store.decks()[slot].detectedKey,
          store.keyDisplayFormat(),
          keySemitones
        );
        return key ?? signedOffset(keySemitones);
      }),
  };
}
