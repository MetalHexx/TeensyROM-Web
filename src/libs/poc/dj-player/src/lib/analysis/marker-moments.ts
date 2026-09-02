import type { DetectedMoment } from './tune-index.model';

/** Offsets, relative to `capturedFrame`, of every stored moment a nudge can actually reach —
 *  ascending, deduped, and never outside ±range, because the engine clamps every offset to that. */
export function reachableMomentOffsets(
  moments: readonly DetectedMoment[],
  capturedFrame: number,
  range: number
): readonly number[] {
  const offsets = new Set<number>();
  for (const moment of moments) {
    const offset = moment.frame - capturedFrame;
    if (offset >= -range && offset <= range) {
      offsets.add(offset);
    }
  }
  return Array.from(offsets).sort((a, b) => a - b);
}

/** The next reachable offset strictly beyond `currentOffset` in `direction`, or null when there is
 *  none — which is what makes a control unavailable rather than inert. */
export function nextMomentOffset(
  moments: readonly DetectedMoment[],
  capturedFrame: number,
  currentOffset: number,
  range: number,
  direction: -1 | 1
): number | null {
  const reachable = reachableMomentOffsets(moments, capturedFrame, range);
  if (direction === 1) {
    for (const offset of reachable) {
      if (offset > currentOffset) return offset;
    }
    return null;
  }
  for (let i = reachable.length - 1; i >= 0; i--) {
    if (reachable[i] < currentOffset) return reachable[i];
  }
  return null;
}
