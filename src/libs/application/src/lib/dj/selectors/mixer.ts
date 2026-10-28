import { computed } from '@angular/core';
import { sharedScaleNotes } from '@sidablist/analysis';
import { DeckPanelState, DeckState, DeckStatus, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';
import { keyDisplayFor, shiftedKeyFor } from '../mixer/key-display';
import { keyMatchStateFor, type KeyMatchState } from '../mixer/key-match';

const SHAPEABLE_STATUSES: readonly DeckStatus[] = ['playing', 'paused', 'stopped'];

/** A slot's SID panel. The key display format is read through the state signal
 *  `store.keyDisplayFormat()`. */
export function deckPanel(store: WritableStore<DjState>) {
  return {
    deckPanel: (slot: Slot) => computed<DeckPanelState>(() => store.panel()[slot]),
  };
}

/** The rule behind `canShape`, over just the fields it reads so a caller can feed it from
 *  fine-grained signals. */
export function isShapeable(deck: Pick<DeckState, 'loaded' | 'switching' | 'status'>): boolean {
  return deck.loaded !== null && !deck.switching && SHAPEABLE_STATUSES.includes(deck.status);
}

/** Whether a deck's tune-shaping controls are live: a tune is loaded, no load or subtune switch is
 *  running, and the deck sits at a settled transport status. Deliberately not `busy`, which also
 *  spans the `await` in a play toggle and would dim the controls on every Play press. */
export function canShape(store: WritableStore<DjState>) {
  return {
    canShape: (slot: Slot) => computed<boolean>(() => isShapeable(store.decks()[slot])),
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
        const { keySemitones } = store.panel()[slot];
        const key = keyDisplayFor(
          store.decks()[slot].detectedKey,
          store.keyDisplayFormat(),
          keySemitones
        );
        return key ?? signedOffset(keySemitones);
      }),
  };
}

/** How well the two decks' keys, each shifted by its own Key knob, fit together: `'none'` while
 *  either deck has no detected key, otherwise the state for the notes their scales share. Reads
 *  neither the readout format nor any speed field. */
export function keyMatch(store: WritableStore<DjState>) {
  return {
    keyMatch: () =>
      computed<KeyMatchState>(() => {
        const a = shiftedKeyFor(store.decks().A.detectedKey, store.panel().A.keySemitones);
        const b = shiftedKeyFor(store.decks().B.detectedKey, store.panel().B.keySemitones);
        if (a === null || b === null) return 'none';
        return keyMatchStateFor(sharedScaleNotes(a, b));
      }),
  };
}
