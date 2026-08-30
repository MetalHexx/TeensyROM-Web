/** Shared by every engine collaborator that turns a µs interval into a millisecond one. */
export const MICROSECONDS_PER_SECOND = 1_000_000;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A usable frame span: a finite number greater than zero, else null. Shared by the loop period
 *  `MarkerState.setTuneLoop` arms against and the basis `TuneSession.setIndexedLengthFrames` divides
 *  by, which are derived from the same record and must agree on what counts as usable. */
export function sanitizePositiveFrame(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** A usable loop start: a finite frame at or after the start of the tune, else null. Distinct from
 *  `sanitizePositiveFrame` because 0 — a tune that repeats from the very top — is a valid start. */
export function sanitizeStartFrame(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** What detection found, as the three fields a `TuneIndexRecord` stores it in. Stated structurally so
 *  a stored record and a freshly computed one both satisfy it without this leaf module having to
 *  depend on the record type. */
export interface DetectedLoopFrames {
  readonly loopStartFrame: number | null;
  readonly loopPeriodFrames: number | null;
  readonly endedAtFrame: number | null;
}

/** What a position percentage is measured against: one intro plus one lap for a looping tune, the
 *  end point for a tune that stopped, and null — meaning "fall back to the fixed ceiling" — for a
 *  tune detection could not answer for.
 *
 *  The one length rule in the player: the playhead's basis and both analysis panels' readouts run
 *  through it, which is what stops them reporting different lengths for the same tune. */
export function positionBasisFor(loop: DetectedLoopFrames | null): number | null {
  if (loop === null) return null;
  const period = sanitizePositiveFrame(loop.loopPeriodFrames);
  if (period === null) return sanitizePositiveFrame(loop.endedAtFrame);
  return (sanitizeStartFrame(loop.loopStartFrame) ?? 0) + period;
}
