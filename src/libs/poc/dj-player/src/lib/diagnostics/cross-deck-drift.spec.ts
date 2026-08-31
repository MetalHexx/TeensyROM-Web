import { describe, it, expect } from 'vitest';
import { crossDeckDriftMs, formatCrossDeckDrift } from './cross-deck-drift';
import type { EngineStats } from '../engine/dj-player-engine';

function statsWithDrift(driftMs: number): EngineStats {
  return {
    framesRendered: 0,
    packetsSent: 0,
    bytesSent: 0,
    suppressedWrites: 0,
    illegalOpcodeCount: 0,
    callsPerFrame: 1,
    effectiveIntervalUs: 0,
    measuredMeanIntervalUs: 0,
    driftMs,
    jitterMs: 0,
    worstGapMs: 0,
    lateCallbacks: 0,
    scheduledFrames: 0,
    lateFrames: 0,
    meanLagMs: 0,
    worstLagMs: 0,
    reorderedFrames: 0,
    clampedFrames: 0,
    cancelSupported: false,
    lastCancelLatencyMs: -1,
  };
}

describe('crossDeckDriftMs', () => {
  it('is the difference between two decks own drift figures', () => {
    expect(crossDeckDriftMs(statsWithDrift(12.4), statsWithDrift(4.0))).toBeCloseTo(8.4);
  });

  it('is negative when the second deck has walked further than the first', () => {
    expect(crossDeckDriftMs(statsWithDrift(4.0), statsWithDrift(12.4))).toBeCloseTo(-8.4);
  });

  it('is null when the first deck is not registered', () => {
    expect(crossDeckDriftMs(null, statsWithDrift(4.0))).toBeNull();
  });

  it('is null when the second deck is not registered', () => {
    expect(crossDeckDriftMs(statsWithDrift(4.0), null)).toBeNull();
  });

  it('is null when neither deck is registered', () => {
    expect(crossDeckDriftMs(null, null)).toBeNull();
  });

  it('is zero for two decks that have walked apart by the same amount', () => {
    expect(crossDeckDriftMs(statsWithDrift(6.0), statsWithDrift(6.0))).toBe(0);
  });
});

describe('formatCrossDeckDrift', () => {
  it("reads 'A−B: +12.4 ms' for a positive gap, signed and to one decimal place", () => {
    expect(formatCrossDeckDrift(['A', 'B'], 12.4)).toBe('A−B: +12.4 ms');
  });

  it('signs a negative gap with a minus rather than reporting the absolute value unsigned', () => {
    expect(formatCrossDeckDrift(['A', 'B'], -8.4)).toBe('A−B: −8.4 ms');
  });

  it('signs a zero gap positive rather than reporting it unsigned', () => {
    expect(formatCrossDeckDrift(['A', 'B'], 0)).toBe('A−B: +0.0 ms');
  });

  it('reads em dash when there are no labels to compare', () => {
    expect(formatCrossDeckDrift(null, 12.4)).toBe('—');
  });

  it('reads em dash when there is no drift figure to report, even with labels present', () => {
    expect(formatCrossDeckDrift(['A', 'B'], null)).toBe('—');
  });
});
