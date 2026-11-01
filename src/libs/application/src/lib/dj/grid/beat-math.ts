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
