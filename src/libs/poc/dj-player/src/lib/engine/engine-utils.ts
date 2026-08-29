/** Shared by every engine collaborator that turns a µs interval into a millisecond one. */
export const MICROSECONDS_PER_SECOND = 1_000_000;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A usable frame count for a position basis or a loop point: a finite number greater than zero,
 *  else null. Shared by `MarkerState.setTuneLoop` and `TuneSession.setIndexedLengthFrames`, which
 *  are both fed the same `record?.loopFrame ?? null` and must agree on what counts as usable. */
export function sanitizePositiveFrame(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
