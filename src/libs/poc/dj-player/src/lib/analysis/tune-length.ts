/** A usable frame span: a finite number greater than zero, else null. Shared by the loop period and
 *  the basis below, which are derived from the same record and must agree on what counts as usable. */
function sanitizePositiveFrame(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** A usable loop start: a finite frame at or after the start of the tune, else null. Distinct from
 *  `sanitizePositiveFrame` because 0 — a tune that repeats from the very top — is a valid start. */
function sanitizeStartFrame(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** What detection found, as the three fields a `TuneIndexRecord` stores it in. Stated structurally so
 *  a stored record and a freshly computed one both satisfy it without this leaf module having to
 *  depend on the record type. Core's own `DetectedLoopFrames` is the same three fields in branded
 *  frame units; a record's plain numbers widen into this without a conversion. */
export interface DetectedLoopFrames {
  readonly loopStartFrame: number | null;
  readonly loopPeriodFrames: number | null;
  readonly endedAtFrame: number | null;
}

/** What a position percentage is measured against: one intro plus one lap for a looping tune, the
 *  end point for a tune that stopped, and null — meaning "fall back to the fixed ceiling" — for a
 *  tune detection could not answer for.
 *
 *  The one length rule in the player: both analysis panels' readouts and the transport's own bar run
 *  through it, which is what stops them reporting different lengths for the same tune. Core resolves
 *  the same length itself, off the track structure it is handed, so a reading taken here and the
 *  basis the playhead moves against agree by construction rather than by coincidence. */
export function positionBasisFor(loop: DetectedLoopFrames | null): number | null {
  if (loop === null) return null;
  const period = sanitizePositiveFrame(loop.loopPeriodFrames);
  if (period === null) return sanitizePositiveFrame(loop.endedAtFrame);
  return (sanitizeStartFrame(loop.loopStartFrame) ?? 0) + period;
}

/** The share of an ended tune's bar its music occupies. A SID that has ended sits in a static idle
 *  cycle *forever*, so the dead tail measures no finite duration and cannot be derived from one — it
 *  is a token "nothing follows this", and a fixed share is the honest way to draw it. */
const ENDED_MUSIC_FRACTION = 0.8;

/** What the position bar is drawn against — distinct from `positionBasisFor`, which is the tune's
 *  *length*. A looping tune's timeline is exactly one intro plus one lap. An ended tune's runs a
 *  fixed fraction past its end point so the dead tail is drawable at a stable proportion whatever
 *  the tune's length. A tune with no answer has no timeline of its own: null falls back to the
 *  ceiling.
 *
 *  The ceiling is wrong for the ended case, though it is right for the unknown one: the ceiling is a
 *  fixed 300 s (`JUMP_CEILING_SECONDS`) while the ladder detects endings out to 750 s. Measuring an
 *  ended tune against it gives a music region over 100% for any tune ending past 300 s — an
 *  overflowing flex row, no dead tail — and a bar that is ~87% dead for a tune ending at 40 s.
 *  Deriving the span from the end point instead makes the proportion constant and the arithmetic
 *  total. */
export function timelineBasisFor(loop: DetectedLoopFrames | null): number | null {
  if (loop === null) return null;
  const period = sanitizePositiveFrame(loop.loopPeriodFrames);
  if (period !== null) {
    return (sanitizeStartFrame(loop.loopStartFrame) ?? 0) + period;
  }
  const endedAt = sanitizePositiveFrame(loop.endedAtFrame);
  if (endedAt === null) return null;
  return Math.round(endedAt / ENDED_MUSIC_FRACTION);
}
