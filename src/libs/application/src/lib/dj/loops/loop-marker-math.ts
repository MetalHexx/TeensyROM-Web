import type { DeckLoopBoundary, DeckLoopMarker } from '../dj-store';

export type LoopBoundaryName = 'start' | 'end';

export type MarkerKind = 'loop' | 'cue';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The frame the engine jumps to for a boundary: its captured frame plus its nudge, never before
 *  the start of the tune. */
export function resolvedFrame(boundary: DeckLoopBoundary): number {
  return Math.max(0, boundary.frame + boundary.offsetFrames);
}

/** A loop only when its end lies after its start; anything else is a cue. */
export function markerKind(marker: DeckLoopMarker): MarkerKind {
  return marker.end !== null && resolvedFrame(marker.end) > resolvedFrame(marker.start)
    ? 'loop'
    : 'cue';
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
 * The offsets a nudge may give `boundary`: within one second either way, and never so far that the
 * loop's resolved end is not at least one frame after its resolved start. A start nudge is limited
 * by the end, and an end nudge by the start. A marker with no end has no second boundary to bound
 * its start.
 */
export function nudgeLimits(
  marker: DeckLoopMarker,
  boundary: LoopBoundaryName,
  oneSecond: number
): { readonly min: number; readonly max: number } {
  const earliest = 0 - oneSecond; // not `-oneSecond`, which is -0 while the second is unknown
  if (boundary === 'start') {
    const latest =
      marker.end === null
        ? oneSecond
        : Math.min(oneSecond, resolvedFrame(marker.end) - 1 - marker.start.frame);
    return { min: earliest, max: latest };
  }
  if (marker.end === null) {
    return { min: 0, max: 0 };
  }
  return {
    min: Math.max(earliest, resolvedFrame(marker.start) + 1 - marker.end.frame),
    max: oneSecond,
  };
}
