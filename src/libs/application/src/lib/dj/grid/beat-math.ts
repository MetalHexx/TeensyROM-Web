import { lapPhaseAt, type LadderSize } from '@sidablist/analysis';
import { reduceLapPhase } from '@sidablist/core';
import type { DeckBeatGrid } from '../dj-store';

// The ladder of loop lengths lives with the engine's grid arithmetic: one ladder, and the existing
// importers keep their path.
export { lengthLadder, type LadderSize } from '@sidablist/analysis';

/**
 * A loop's lap phase as the app hands it to the engine (core's `ActiveLoop.lapPhase`): reduced to
 * its fractional part, and undefined for 0 — the phase a loop given none laps at — so a loop on a
 * whole-frame line reaches the engine exactly as it always has. Undefined for null too.
 */
export function lapPhaseOrNone(phase: number | null | undefined): number | undefined {
  if (phase === null || phase === undefined) {
    return undefined;
  }
  const reduced = reduceLapPhase(phase);
  return reduced === 0 ? undefined : reduced;
}

/**
 * The lap phase of a loop `lengthFrames` long that starts at `startFrame`, from the deck's grid:
 * where the line it starts on lies before rounding — a line of its own length below a beat, a beat
 * line at a beat or more, the line a live loop's push picks — so a length that is not a whole number
 * of frames laps in the alternating lengths whose ends land on that grid's lines. As
 * `lapPhaseOrNone` gives it; undefined with no grid, and for a start on no line, which laps from a
 * whole frame.
 */
export function loopLapPhase(
  grid: DeckBeatGrid | null,
  startFrame: number,
  lengthFrames: number
): number | undefined {
  if (grid === null) {
    return undefined;
  }
  const period = lengthFrames >= grid.beatFrames ? grid.beatFrames : lengthFrames;
  return lapPhaseOrNone(lapPhaseAt(grid, period, startFrame));
}

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

/** The index in `ladder` of the rung whose beats are nearest `beats`, the shorter on a tie; -1 for
 *  an empty ladder. */
export function nearestRungIndex(ladder: readonly LadderSize[], beats: number): number {
  let best = -1;
  ladder.forEach((rung, index) => {
    if (best < 0 || Math.abs(rung.beats - beats) < Math.abs(ladder[best].beats - beats)) {
      best = index;
    }
  });
  return best;
}

/** How far from a whole frame a size may fall and still count as one: float noise from a tapped
 *  grid's beat length, not a real fraction. */
const WHOLE_FRAME_TOLERANCE = 1e-9;

/** A length in beats as the screen writes it: `1 BEAT`, `5 BEATS`, `1/2 BEAT`, `1/16 BEAT`. */
export function beatsLabel(beats: number): string {
  if (Number.isInteger(beats)) {
    return `${beats} ${beats === 1 ? 'BEAT' : 'BEATS'}`;
  }
  const parts = Math.round(1 / beats);
  if (beats < 1 && Math.abs(parts * beats - 1) < WHOLE_FRAME_TOLERANCE) {
    return `1/${parts} BEAT`;
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
