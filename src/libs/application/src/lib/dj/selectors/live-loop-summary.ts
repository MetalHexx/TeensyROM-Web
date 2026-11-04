import { computed } from '@angular/core';
import { DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';
import { percentOf } from '../loops/loop-marker-math';
import { beatsLabel, lengthLadder, nearestRungIndex } from '../grid/beat-math';

/** One size the live loop's picker offers. */
export interface LiveLoopSizeOption {
  readonly beats: number;
  readonly label: string;
  readonly selected: boolean;
}

export interface LiveLoopSummary {
  /** The deck has a tune with a grid and a non-empty ladder of sizes. */
  readonly available: boolean;
  readonly running: boolean;
  /** The size the live loop takes, as the screen writes it: '½ BEAT', '4 BEATS'. */
  readonly sizeText: string;
  /** The ladder sizes the grid holds in whole frames, ascending; empty when unavailable. */
  readonly sizeOptions: readonly LiveLoopSizeOption[];
  readonly canHalve: boolean;
  readonly canDouble: boolean;
  readonly slip: boolean;
  /** A running live loop, for the strip only. */
  readonly mark: { readonly startPercent: number; readonly endPercent: number } | null;
}

/**
 * A deck's live loop, ready to draw. The size is the ladder rung nearest the deck's kept size, so a
 * size the grid lacks shows as the rung the loop would take. Reads the deck's fields one signal at a
 * time and never the playhead (`positions`). The live loop is never one of `loopsSummary`'s items.
 */
export function liveLoopSummary(store: WritableStore<DjState>) {
  return {
    liveLoopSummary: (slot: Slot) => {
      const deck = store.decks[slot];
      const live = store.loops[slot].live;

      return computed<LiveLoopSummary>(() => {
        const grid = deck.beatGrid();
        const beats = deck.liveLoopBeats();
        const lengthFrames = deck.lengthFrames();
        const running = live();

        const ladder = grid === null ? [] : lengthLadder(grid.beatFrames);
        const index = nearestRungIndex(ladder, beats);

        return {
          available: ladder.length > 0,
          running: running !== null,
          sizeText: beatsLabel(index < 0 ? beats : ladder[index].beats),
          sizeOptions: ladder.map((rung, i) => ({
            beats: rung.beats,
            label: beatsLabel(rung.beats),
            selected: i === index,
          })),
          canHalve: index > 0,
          canDouble: index >= 0 && index < ladder.length - 1,
          slip: deck.slip(),
          mark:
            running === null
              ? null
              : {
                  startPercent: percentOf(running.startFrame, lengthFrames),
                  endPercent: percentOf(running.endFrame, lengthFrames),
                },
        };
      });
    },
  };
}
