import type { EngineStats } from '../engine/dj-player-engine';

/**
 * How far two independently-clocked decks have walked apart: the difference between each deck's own
 * clock drift — measured − nominal since its play() — which is each deck's position in time against
 * where it should be. Null when fewer than two decks are registered, so the caller passes what it
 * has rather than deciding how to render the gap.
 *
 * Each deck's drift accumulates from its own `play()`, so this compares two running clocks rather
 * than stating an absolute offset between two tunes — a deck that has been playing longer has simply
 * had more time to walk, whatever its own rate. No correction is attempted: two beatmatched decks
 * walking apart is the honest cost of independence, and how fast it happens is what this figure
 * exists to find out.
 */
export function crossDeckDriftMs(a: EngineStats | null, b: EngineStats | null): number | null {
  return a === null || b === null ? null : a.driftMs - b.driftMs;
}

/** 'A−B: +12.4 ms', or '—' when there is nothing to compare. */
export function formatCrossDeckDrift(
  labels: readonly [string, string] | null,
  driftMs: number | null
): string {
  if (labels === null || driftMs === null) return '—';
  const [a, b] = labels;
  const sign = driftMs >= 0 ? '+' : '−';
  return `${a}−${b}: ${sign}${Math.abs(driftMs).toFixed(1)} ms`;
}
