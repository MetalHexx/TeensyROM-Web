// A small re-statement of `@sidablist/analysis`' `reachableMomentOffsets` and `nextMomentOffset`
// over bare frame numbers: the application never imports `analysis`, so the rule is mirrored here.

export type LoopSnapDirection = 'previous' | 'next';

/** Offsets, relative to `anchorFrame`, of every moment a nudge can reach: ascending, deduped, and
 *  never outside ±`rangeFrames`. */
export function reachableOffsets(
  moments: readonly number[],
  anchorFrame: number,
  rangeFrames: number
): number[] {
  const offsets = new Set<number>();
  for (const moment of moments) {
    const offset = moment - anchorFrame;
    if (offset >= -rangeFrames && offset <= rangeFrames) {
      offsets.add(offset);
    }
  }
  return Array.from(offsets).sort((a, b) => a - b);
}

/** The next reachable offset strictly beyond `currentOffset` in `direction`, or null when there is
 *  none. */
export function nextOffset(
  moments: readonly number[],
  anchorFrame: number,
  currentOffset: number,
  rangeFrames: number,
  direction: LoopSnapDirection
): number | null {
  const reachable = reachableOffsets(moments, anchorFrame, rangeFrames);
  if (direction === 'next') {
    return reachable.find((offset) => offset > currentOffset) ?? null;
  }
  for (let i = reachable.length - 1; i >= 0; i--) {
    if (reachable[i] < currentOffset) {
      return reachable[i];
    }
  }
  return null;
}
