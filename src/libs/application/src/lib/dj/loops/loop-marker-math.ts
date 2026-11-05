import { isUsableLoopLength } from '@sidablist/core';
import type { DeckLoopBoundary, DeckLoopMarker } from '../dj-store';

export type MarkerKind = 'loop' | 'cue';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** `frame` as a share of the tune's length, 0–100; 0 while the length is unknown. */
export function percentOf(frame: number, lengthFrames: number | null): number {
  return lengthFrames === null || lengthFrames <= 0
    ? 0
    : clamp((frame / lengthFrames) * 100, 0, 100);
}

/** The frame the engine jumps to for a boundary: its captured frame plus its offset, never before
 *  the start of the tune. */
export function resolvedFrame(boundary: DeckLoopBoundary): number {
  return Math.max(0, boundary.frame + boundary.offsetFrames);
}

/**
 * A loop only when its end lies after its start, by a length the engine can lap
 * (`isUsableLoopLength`); anything else is a cue. A length between two frames that is under
 * `MIN_FRACTIONAL_LOOP_FRAMES` is one no edit here makes, but a stored marker may hold one: the
 * engine refuses it as a loop, so it plays as a cue, the way an end at or before the start does,
 * rather than read as running while the engine loops something else.
 */
export function markerKind(marker: DeckLoopMarker): MarkerKind {
  if (marker.end === null) {
    return 'cue';
  }
  const start = resolvedFrame(marker.start);
  const end = resolvedFrame(marker.end);
  return end > start && isUsableLoopLength(start, end) ? 'loop' : 'cue';
}

/** The marker's name, else 'Loop N' / 'Cue N' — N its 1-based place among the list's markers of
 *  the same kind (`markerKind`), named ones included. */
export function markerLabel(markers: readonly DeckLoopMarker[], index: number): string {
  const marker = markers[index];
  if (marker.name !== null) {
    return marker.name;
  }
  const kind = markerKind(marker);
  const place = markers.slice(0, index + 1).filter((other) => markerKind(other) === kind).length;
  return `${kind === 'loop' ? 'Loop' : 'Cue'} ${place}`;
}

/** Play calls in one second of music. Frames are play calls and the interval is independent of
 *  tempo, so this window is in music time. 0 while the interval is unknown. */
export function oneSecondFrames(playCallIntervalUs: number | null): number {
  if (
    playCallIntervalUs === null ||
    !Number.isFinite(playCallIntervalUs) ||
    playCallIntervalUs <= 0
  ) {
    return 0;
  }
  return Math.round(1_000_000 / playCallIntervalUs);
}
