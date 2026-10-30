import { computed } from '@angular/core';
import { DeckLoopBoundary, DeckLoopMarker, DjState, WritableStore } from '../dj-store';
import type { Slot } from '../slot';
import {
  clamp,
  markerKind,
  oneSecondFrames,
  resolvedFrame,
  type LoopBoundaryName,
} from '../loops/loop-marker-math';
import { nextOffset, reachableOffsets, type LoopSnapDirection } from '../loops/moment-reach';
import { isShapeable } from './mixer';
import { formatElapsed, formatSeconds } from './transport-time';

export type { LoopBoundaryName, LoopSnapDirection };

export type LoopActivity = 'idle' | 'queued' | 'running';

export interface LoopItemSummary {
  readonly id: string;
  /** The marker's name, else 'Item N' by list position. */
  readonly name: string;
  readonly kind: 'loop' | 'cue';
  /** '7.8s' for a loop, 'CUE' for a cue. */
  readonly lengthText: string;
  readonly activity: LoopActivity;
  readonly selected: boolean;
  readonly ready: boolean;
  /** GBL unlatched: the marker plays with its own mixer settings. */
  readonly ownSettings: boolean;
  /** Of the tune's length, for the strip. */
  readonly startPercent: number;
  /** Null for a cue. */
  readonly endPercent: number | null;
}

export interface LoopBoundarySummary {
  readonly offsetFrames: number;
  /** One second of play calls either way. */
  readonly rangeFrames: number;
  /** Where each reachable detected moment sits on the boundary's ±range track: 0–100. */
  readonly tickPercents: readonly number[];
  readonly canSnapPrevious: boolean;
  readonly canSnapNext: boolean;
}

export interface LoopSelectionSummary {
  readonly id: string;
  readonly name: string;
  readonly kind: 'loop' | 'cue';
  readonly activity: LoopActivity;
  readonly ready: boolean;
  /** GBL latched: the marker shares the main track's mixer settings. */
  readonly sharesGlobal: boolean;
  /** WRAP latched: a scrubbed record wraps from the loop's start to its end instead of stopping. */
  readonly wraps: boolean;
  /** 'start–end' elapsed times for a loop, the start alone for a cue. */
  readonly spanText: string;
  readonly start: LoopBoundarySummary;
  readonly end: LoopBoundarySummary | null;
}

export interface DeckLoopsSummary {
  readonly hasTune: boolean;
  readonly canAdd: boolean;
  readonly canStop: boolean;
  readonly items: readonly LoopItemSummary[];
  readonly selected: LoopSelectionSummary | null;
}

function percentOf(frame: number, lengthFrames: number | null): number {
  return lengthFrames === null || lengthFrames <= 0
    ? 0
    : clamp((frame / lengthFrames) * 100, 0, 100);
}

function boundarySummary(
  boundary: DeckLoopBoundary,
  moments: readonly number[],
  rangeFrames: number
): LoopBoundarySummary {
  const ticks = rangeFrames > 0 ? reachableOffsets(moments, boundary.frame, rangeFrames) : [];
  return {
    offsetFrames: boundary.offsetFrames,
    rangeFrames,
    tickPercents: ticks.map((offset) => ((offset + rangeFrames) / (2 * rangeFrames)) * 100),
    canSnapPrevious:
      nextOffset(moments, boundary.frame, boundary.offsetFrames, rangeFrames, 'previous') !== null,
    canSnapNext:
      nextOffset(moments, boundary.frame, boundary.offsetFrames, rangeFrames, 'next') !== null,
  };
}

/**
 * A deck's loop tiles and its selected marker's boundaries, ready to draw. Reads the deck's fields
 * one signal at a time and never the playhead (`positions`), so a sample does not rebuild it — the
 * lap indicator has its own selector for that.
 */
export function loopsSummary(store: WritableStore<DjState>) {
  return {
    loopsSummary: (slot: Slot) => {
      const deck = store.decks[slot];
      const loops = store.loops[slot];

      return computed<DeckLoopsSummary>(() => {
        const { markers, selectedId, runningId, queuedId, detectedMoments, settingsInPlayId } =
          loops();
        const lengthFrames = deck.lengthFrames();
        const intervalUs = deck.playCallIntervalUs();
        const loaded = deck.loaded();

        const activityOf = (marker: DeckLoopMarker): LoopActivity =>
          marker.id === runningId ? 'running' : marker.id === queuedId ? 'queued' : 'idle';

        const items = markers.map((marker, index): LoopItemSummary => {
          const kind = markerKind(marker);
          const start = resolvedFrame(marker.start);
          const end = marker.end === null ? null : resolvedFrame(marker.end);
          return {
            id: marker.id,
            name: marker.name ?? `Item ${index + 1}`,
            kind,
            lengthText:
              kind === 'loop' && end !== null ? formatSeconds(end - start, intervalUs) : 'CUE',
            activity: activityOf(marker),
            selected: marker.id === selectedId,
            ready: marker.ready,
            ownSettings: marker.ownSettings,
            startPercent: percentOf(start, lengthFrames),
            endPercent: kind === 'loop' && end !== null ? percentOf(end, lengthFrames) : null,
          };
        });

        const selectedIndex = markers.findIndex((marker) => marker.id === selectedId);
        let selected: LoopSelectionSummary | null = null;
        if (selectedIndex >= 0) {
          const marker = markers[selectedIndex];
          const kind = markerKind(marker);
          const range = oneSecondFrames(intervalUs);
          const startText = formatElapsed(resolvedFrame(marker.start), intervalUs);
          selected = {
            id: marker.id,
            name: items[selectedIndex].name,
            kind,
            activity: activityOf(marker),
            ready: marker.ready,
            sharesGlobal: !marker.ownSettings,
            wraps: marker.wraps,
            spanText:
              kind === 'loop' && marker.end !== null
                ? `${startText}–${formatElapsed(resolvedFrame(marker.end), intervalUs)}`
                : startText,
            start: boundarySummary(marker.start, detectedMoments, range),
            end: marker.end === null ? null : boundarySummary(marker.end, detectedMoments, range),
          };
        }

        return {
          hasTune: loaded !== null,
          canAdd: isShapeable({ loaded, switching: deck.switching(), status: deck.status() }),
          canStop: runningId !== null || queuedId !== null || settingsInPlayId !== null,
          items,
          selected,
        };
      });
    },
  };
}
