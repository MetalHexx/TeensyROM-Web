import { computed } from '@angular/core';
import { DeckState, DeckStatus, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';
import { formatTotal } from './transport-time';

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

/** Everything the transport shows except the playhead, which `PlayheadPainter` paints. */
export interface DeckTransportSummary {
  status: DeckStatus;
  led: 'stopped' | 'playing' | 'paused' | 'ended' | 'error' | 'analyzing';
  label: string;
  showing: 'play' | 'pause';
  controlsDisabled: boolean;
  canStop: boolean;
  bar: DeckBarState;
  title: string | null;
  author: string | null;
  /** 'mm:ss' tune length; '--:--' while the length or the play-call interval is unknown. */
  totalText: string;
  subtuneText: string;
  /** `subtune/subtuneCount`, '–/–' while nothing is loaded. */
  subtuneCompact: string;
  subtuneDisabled: boolean;
  repeat: boolean;
  /** A finger is on the deck's pitch bend strip. The word shown for it is the view's to compose. */
  held: boolean;
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

/** The transport panel's display model for one deck, derived from its raw state — all of it but
 *  the playhead. It never reads `positions`, so a playhead sample leaves it, and every model built
 *  from it, with the same identity; `PlayheadPainter` paints the readouts that move. */
export function transportSummary(store: WritableStore<DjState>) {
  return {
    transportSummary: (slot: Slot) =>
      computed<DeckTransportSummary>(() => {
        const deck = store.decks()[slot];
        const led = ledFor(deck.status);
        // `failed` included alongside `empty`: DeckService.togglePlayPause() is a deliberate no-op
        // for a failed deck (there is nothing loaded to resume), so the Play toggle has to render
        // disabled here too or it dead-clicks — matching the Errored transport-panel story.
        const controlsDisabled = deck.status === 'empty' || deck.status === 'failed' || deck.busy;

        return {
          status: deck.status,
          led,
          label: labelFor(deck.status, led, deck.error),
          showing: deck.status === 'playing' ? 'pause' : 'play',
          controlsDisabled,
          canStop: (deck.status === 'playing' || deck.status === 'paused') && !deck.busy,
          bar: barFor(deck),
          title: deck.loaded?.title ?? null,
          author: deck.loaded?.author ?? null,
          totalText: formatTotal(deck.lengthFrames, deck.playCallIntervalUs),
          subtuneText: `Subtune ${deck.subtune} of ${deck.subtuneCount}`,
          subtuneCompact: deck.subtuneCount === 0 ? '–/–' : `${deck.subtune}/${deck.subtuneCount}`,
          subtuneDisabled: controlsDisabled || deck.subtuneCount <= 1,
          repeat: deck.repeat,
          held: deck.handHeld,
          errors: [],
        };
      }),
  };
}
