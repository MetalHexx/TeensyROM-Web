import { computed } from '@angular/core';
import { DeckState, DeckStatus, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';

/** The position bar's fixed dead-tail share for an ended tune — a SID that has ended sits in a
 *  static idle cycle forever, so the tail has no finite duration to derive a share from. Matches
 *  `sidablist/analysis`'s `ENDED_MUSIC_FRACTION` (0.8), inlined here because the application never
 *  imports `analysis`. */
const ENDED_MUSIC_PERCENT = 80;

/** Structurally identical to the UI's `ScrubBarState` (`libs/ui/components`). `unknown` is a
 *  verdict (nothing detected), `analyzing` a transient (nothing looked for yet). */
export type DeckBarState =
  | { kind: 'analyzing' }
  | { kind: 'unknown' }
  | { kind: 'loop'; introPercent: number }
  | { kind: 'ended'; musicPercent: number };

export interface DeckTransportSummary {
  status: DeckStatus;
  led: 'stopped' | 'playing' | 'paused' | 'ended' | 'error' | 'analyzing';
  label: string;
  showing: 'play' | 'pause';
  controlsDisabled: boolean;
  canStop: boolean;
  scrubPercent: number;
  bar: DeckBarState;
  frameLabel: string;
  subtuneText: string;
  subtuneDisabled: boolean;
  repeat: boolean;
  errors: readonly string[];
}

function ledFor(status: DeckStatus): 'stopped' | 'playing' | 'paused' | 'error' | 'analyzing' {
  if (status === 'loading' || status === 'indexing') return 'analyzing';
  if (status === 'failed') return 'error';
  if (status === 'empty') return 'stopped';
  return status;
}

/** The POC's four-entry table. `failed` never reads this — its label is the error reason instead. */
function labelFor(status: DeckStatus, led: ReturnType<typeof ledFor>, error: string | null): string {
  if (status === 'failed') return error ?? '';
  if (led === 'analyzing') return 'Analyzing…';
  if (led === 'playing') return 'Playing';
  if (led === 'paused') return 'Paused';
  return 'Stopped';
}

function barFor(deck: DeckState): DeckBarState {
  if (deck.status === 'indexing') return { kind: 'analyzing' };

  const structure = deck.structure;
  if (!structure) return { kind: 'unknown' };

  const { loopStartFrame, loopPeriodFrames, endedAtFrame } = structure;
  if (loopPeriodFrames !== null && loopPeriodFrames > 0) {
    const start = loopStartFrame ?? 0;
    return { kind: 'loop', introPercent: (start / (start + loopPeriodFrames)) * 100 };
  }
  if (endedAtFrame !== null && endedAtFrame > 0) {
    return { kind: 'ended', musicPercent: ENDED_MUSIC_PERCENT };
  }
  return { kind: 'unknown' };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The transport panel's whole display model for one deck, derived from its raw state. */
export function transportSummary(store: WritableStore<DjState>) {
  return {
    transportSummary: (slot: Slot) =>
      computed<DeckTransportSummary>(() => {
        const deck = store.decks()[slot];
        const led = ledFor(deck.status);
        const controlsDisabled = deck.status === 'empty' || deck.busy;

        return {
          status: deck.status,
          led,
          label: labelFor(deck.status, led, deck.error),
          showing: deck.status === 'playing' ? 'pause' : 'play',
          controlsDisabled,
          canStop: (deck.status === 'playing' || deck.status === 'paused') && !deck.busy,
          scrubPercent:
            deck.lengthFrames === null
              ? 0
              : clamp((deck.positionFrames / deck.lengthFrames) * 100, 0, 100),
          bar: barFor(deck),
          frameLabel: `frame ${deck.positionFrames}`,
          subtuneText: `Subtune ${deck.subtune} of ${deck.subtuneCount}`,
          subtuneDisabled: controlsDisabled || deck.subtuneCount <= 1,
          repeat: deck.repeat,
          errors: [],
        };
      }),
  };
}
