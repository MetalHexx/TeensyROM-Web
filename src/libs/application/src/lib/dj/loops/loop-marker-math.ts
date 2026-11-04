import { isUsableLoopLength, MIN_FRACTIONAL_LOOP_FRAMES } from '@sidablist/core';
import type { DeckLoopBoundary, DeckLoopMarker } from '../dj-store';

export type LoopBoundaryName = 'start' | 'end';

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

/** The frame the engine jumps to for a boundary: its captured frame plus its nudge, never before
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

/**
 * The shortest a nudge may leave a loop: one frame, or `MIN_FRACTIONAL_LOOP_FRAMES` when its length
 * is not a whole number of frames — such a loop laps in alternating whole-frame lengths, each a play
 * call and its gate-off at least, and the engine refuses one shorter. A nudge moves by whole frames,
 * so it never changes which of the two a loop is.
 */
function shortestNudgedLength(marker: DeckLoopMarker): number {
  return marker.end === null || Number.isInteger(marker.end.frame - marker.start.frame)
    ? 1
    : MIN_FRACTIONAL_LOOP_FRAMES;
}

/**
 * The offsets a nudge may give `boundary`: within one second either way, and never so far that the
 * loop's resolved end is not at least one frame after its resolved start — two for a length that is
 * not a whole number of frames (`shortestNudgedLength`). A start nudge is limited by the end, and an
 * end nudge by the start. A marker with no end has no second boundary to bound its start. Both
 * limits are whole frames, even for an end that falls between two.
 */
export function nudgeLimits(
  marker: DeckLoopMarker,
  boundary: LoopBoundaryName,
  oneSecond: number
): { readonly min: number; readonly max: number } {
  const earliest = 0 - oneSecond; // not `-oneSecond`, which is -0 while the second is unknown
  const shortest = shortestNudgedLength(marker);
  if (boundary === 'start') {
    const latest =
      marker.end === null
        ? oneSecond
        : Math.min(
            oneSecond,
            Math.floor(resolvedFrame(marker.end) - shortest - marker.start.frame) + 0
          );
    return { min: earliest, max: latest };
  }
  if (marker.end === null) {
    return { min: 0, max: 0 };
  }
  return {
    // `+ 0` turns the -0 that `Math.ceil` gives a small negative into 0.
    min: Math.max(
      earliest,
      Math.ceil(resolvedFrame(marker.start) + shortest - marker.end.frame) + 0
    ),
    max: oneSecond,
  };
}
