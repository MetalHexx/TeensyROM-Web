import type { DeckBeatGrid } from '../dj-store';

/** True when `frame` falls inside the grid's span: from its start, up to but not including its end. */
export function inGridSpan(grid: DeckBeatGrid, frame: number): boolean {
  return frame >= grid.startFrame && frame < (grid.endFrame ?? Infinity);
}

/** The tempo a beat of `beatFrames` play calls sounds at: play calls of `playCallIntervalUs` each,
 *  at the played `speed` multiplier. */
export function bpmOf(beatFrames: number, playCallIntervalUs: number, speed: number): number {
  return (60e6 / (beatFrames * playCallIntervalUs)) * speed;
}

/** `125.31 BPM`, or `---.-- BPM` with no tempo. */
export function formatBpm(bpm: number | null): string {
  return bpm === null ? '---.-- BPM' : `${bpm.toFixed(2)} BPM`;
}

/** The beat `frame` is in, counted from beat one (negative before it), and how far through that
 *  beat it is, 0 up to but not including 1. */
export function beatAt(grid: DeckBeatGrid, frame: number): { beat: number; phase: number } {
  const beats = (frame - grid.beatOneFrame) / grid.beatFrames;
  const beat = Math.floor(beats);
  return { beat, phase: beats - beat };
}

/** The frame of the beat nearest `frame` that lies at or after 0 and inside the grid's span, or
 *  null when `frame` is outside the span or no beat of the span is nearer. */
export function nearestBeat(grid: DeckBeatGrid, frame: number): number | null {
  if (!inGridSpan(grid, frame)) {
    return null;
  }
  const beatFrameAt = (index: number): number => grid.beatOneFrame + index * grid.beatFrames;
  const usable = (beatFrame: number): boolean => beatFrame >= 0 && inGridSpan(grid, beatFrame);
  const index = Math.round((frame - grid.beatOneFrame) / grid.beatFrames);
  let best: number | null = null;
  for (const candidate of [index - 1, index, index + 1].map(beatFrameAt)) {
    if (!usable(candidate)) {
      continue;
    }
    if (best === null || Math.abs(candidate - frame) < Math.abs(best - frame)) {
      best = candidate;
    }
  }
  return best;
}

/** One size a loop's length can take: a power of two of beats, and the whole frames it lasts. */
export interface LadderSize {
  readonly beats: number;
  readonly frames: number;
}

/** How far from a whole frame a size may fall and still count as one: float noise from a tapped
 *  grid's beat length, not a real fraction. */
const WHOLE_FRAME_TOLERANCE = 1e-9;

/** The ladder's powers of two run from 2^-5 (1/32 beat) to 2^7 (128 beats, 32 bars of four). */
const SHORTEST_POWER = -5;
const LONGEST_POWER = 7;

/** The shortest loop that keeps time, in play calls: one the tune plays and one the engine's re-entry
 *  gate-off takes. The engine stretches a 1-call loop to 2 calls, so a lap of 1 would fall behind
 *  the grid. */
const MIN_LOOP_FRAMES = 2;

/**
 * The lengths a loop can take on a grid of `beatFrames` per beat, ascending: the powers of two from
 * 1/32 to 128 beats whose length is a whole number of frames, at least `MIN_LOOP_FRAMES`. Below the
 * shortest of them sits the shortest whole-frame loop that fits a whole number of times into the beat,
 * when there is a shorter one, so it still keeps time with the grid. At 24 frames a beat the powers
 * start at ⅛ (3 frames), since 1/16 would be 1.5 frames, and 2 frames (1/12 of a beat) sits below.
 *
 * The rung below the powers is a bench experiment (2026-11-01): how short a loop the chip's
 * envelopes carry, with a gate-off every lap, is for the ear to judge.
 */
export function lengthLadder(beatFrames: number): readonly LadderSize[] {
  const sizes: LadderSize[] = [];
  for (let power = SHORTEST_POWER; power <= LONGEST_POWER; power++) {
    const beats = 2 ** power;
    const frames = beats * beatFrames;
    const whole = Math.round(frames);
    if (whole >= MIN_LOOP_FRAMES && Math.abs(frames - whole) < WHOLE_FRAME_TOLERANCE) {
      sizes.push({ beats, frames: whole });
    }
  }
  const division = shortestDivision(beatFrames);
  if (division !== null && (sizes.length === 0 || division < sizes[0].frames)) {
    sizes.unshift({ beats: division / beatFrames, frames: division });
  }
  return sizes;
}

/** The shortest loop of at least `MIN_LOOP_FRAMES` whole frames that fits a whole number of times
 *  into a beat of `beatFrames`, or null when the beat is not a whole number of frames or no shorter
 *  loop divides it. */
function shortestDivision(beatFrames: number): number | null {
  const beat = Math.round(beatFrames);
  if (Math.abs(beatFrames - beat) >= WHOLE_FRAME_TOLERANCE) {
    return null;
  }
  for (let frames = MIN_LOOP_FRAMES; frames < beat; frames++) {
    if (beat % frames === 0) {
      return frames;
    }
  }
  return null;
}

const FRACTION_LABELS: ReadonlyMap<number, string> = new Map([
  [2, '½ BEAT'],
  [4, '¼ BEAT'],
  [8, '⅛ BEAT'],
]);

/** A length in beats as the screen writes it: `1 BEAT`, `5 BEATS`, `½ BEAT`, `1/12 BEAT`. */
export function beatsLabel(beats: number): string {
  if (Number.isInteger(beats)) {
    return `${beats} ${beats === 1 ? 'BEAT' : 'BEATS'}`;
  }
  const parts = Math.round(1 / beats);
  if (beats < 1 && Math.abs(parts * beats - 1) < WHOLE_FRAME_TOLERANCE) {
    return FRACTION_LABELS.get(parts) ?? `1/${parts} BEAT`;
  }
  return `${Number(beats.toFixed(3))} BEATS`;
}

/** Closer than this to a beat, in frames, and a frame counts as on it. */
const ON_BEAT_TOLERANCE = 0.5;

/** True when `frame` is on a beat of the grid's span, to the nearest frame. */
export function onBeat(grid: DeckBeatGrid, frame: number): boolean {
  const beat = nearestBeat(grid, frame);
  return beat !== null && Math.abs(beat - frame) < ON_BEAT_TOLERANCE;
}

/** The frame of the first beat strictly beyond `frame` in `direction` that lies at or after 0 and
 *  inside the grid's span, or null when there is none. */
export function nextBeat(grid: DeckBeatGrid, frame: number, direction: -1 | 1): number | null {
  const index = (frame - grid.beatOneFrame) / grid.beatFrames;
  const beat =
    direction === 1
      ? Math.floor(index + WHOLE_FRAME_TOLERANCE) + 1
      : Math.ceil(index - WHOLE_FRAME_TOLERANCE) - 1;
  const beatFrame = grid.beatOneFrame + beat * grid.beatFrames;
  return beatFrame >= 0 && inGridSpan(grid, beatFrame) ? beatFrame : null;
}

/** The offsets from `anchor`, ascending, of every beat of the span within `rangeFrames` either
 *  way: what the boundary's track draws its ticks from. */
export function beatsInReach(
  grid: DeckBeatGrid,
  anchor: number,
  rangeFrames: number
): readonly number[] {
  const first = Math.ceil((anchor - rangeFrames - grid.beatOneFrame) / grid.beatFrames);
  const last = Math.floor((anchor + rangeFrames - grid.beatOneFrame) / grid.beatFrames);
  const offsets: number[] = [];
  for (let beat = first; beat <= last; beat++) {
    const beatFrame = grid.beatOneFrame + beat * grid.beatFrames;
    if (beatFrame >= 0 && inGridSpan(grid, beatFrame)) {
      offsets.push(beatFrame - anchor);
    }
  }
  return offsets;
}

/** The whole-beat distances the Move controls can shift a loop or an edge by. */
export type MoveStepBeats = 1 | 2 | 4 | 8 | 16;

/**
 * A Move step: a whole number of beats, or `'frame'`, one play call. A frame step moves an edge by
 * its nudge rather than its beat, so the edge keeps the beat it sits on and the grid never moves. It
 * is a bench experiment (2026-11-01) for setting a very short loop onto a transient.
 */
export type MoveStep = 'frame' | MoveStepBeats;

/** The steps the Move picker offers, shortest first. */
export const MOVE_STEPS: readonly MoveStep[] = ['frame', 1, 2, 4, 8, 16];

/** A Move step as the screen writes it: `1 FRAME`, `1 BEAT`, `4 BEATS`. */
export function moveStepLabel(step: MoveStep): string {
  return step === 'frame' ? '1 FRAME' : beatsLabel(step);
}
