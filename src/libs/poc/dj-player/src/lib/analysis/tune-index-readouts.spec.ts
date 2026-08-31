import { describe, it, expect } from 'vitest';
import {
  tuneIndexKeyConfidenceLabel,
  tuneIndexKeyLabel,
  tuneIndexLengthLabel,
  tuneIndexLoopIsImplausible,
  tuneIndexLoopPeriodLabel,
  tuneIndexLoopStartLabel,
} from './tune-index-readouts';
import type { TuneIndexRate } from './tune-index-readouts';
import { TUNE_INDEX_FORMAT_VERSION } from './tune-index.model';
import type { TuneIndexRecord } from './tune-index.model';
import type { PlayRate } from '../engine/play-rate';

/** One play call per 20 ms, so a frame count converts to seconds by a round factor of 50. */
const SINGLE_SPEED: PlayRate = {
  callsPerFrame: 1,
  exactCallsPerFrame: 1,
  roundedCallsPerFrame: 1,
  mode: 'exact',
};

const SINGLE_SPEED_RATE: TuneIndexRate = { nominalIntervalUs: 20_000, playRate: SINGLE_SPEED };

function rateAt(callsPerFrame: number, mode: PlayRate['mode'] = 'exact'): TuneIndexRate {
  return {
    nominalIntervalUs: 20_000,
    playRate: {
      callsPerFrame,
      exactCallsPerFrame: callsPerFrame,
      roundedCallsPerFrame: Math.round(callsPerFrame),
      mode,
    },
  };
}

function fakeRecord(overrides: Partial<TuneIndexRecord> = {}): TuneIndexRecord {
  return {
    filename: 'test.sid',
    subtune: 1,
    loopStartFrame: 0,
    loopPeriodFrames: 6700,
    endedAtFrame: null,
    sectionBoundaries: [],
    tonic: 0,
    mode: 'major',
    camelot: '8B',
    tuningReferenceHz: 440,
    tuningCents: 0,
    keyConfidence: 'weak',
    scalePitchClasses: [],
    dominantIntervalFrames: null,
    pulseConfidence: 'none',
    nativeTempo: null,
    callsPerFrame: 1,
    exactCallsPerFrame: 1,
    timingMode: 'exact',
    formatVersion: TUNE_INDEX_FORMAT_VERSION,
    computedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('tune-index-readouts', () => {
  it('reads as working while a scan is pending, distinct from a declined answer', () => {
    expect(tuneIndexLengthLabel(null, true, SINGLE_SPEED_RATE)).not.toBe('not found');
    expect(tuneIndexLengthLabel(null, true, SINGLE_SPEED_RATE)).not.toMatch(/^\d+:\d{2}$/);
    expect(tuneIndexKeyLabel(null, true)).not.toBe('no clear key');
  });

  it('shows the length, the loop start and period, and the key once a known record lands', () => {
    const record = fakeRecord();

    expect(tuneIndexLengthLabel(record, false, SINGLE_SPEED_RATE)).toBe('2:14');
    expect(tuneIndexLoopStartLabel(record, false)).toBe('0');
    expect(tuneIndexLoopPeriodLabel(record, false, SINGLE_SPEED_RATE)).toBe('2:14');
    expect(tuneIndexKeyLabel(record, false)).toBe('C major · 8B');
    expect(tuneIndexKeyConfidenceLabel(record, false)).toBe('weak');
  });

  it('counts the intro into the length for a tune that only repeats after one', () => {
    const record = fakeRecord({ loopStartFrame: 1500, loopPeriodFrames: 6000 });

    // One intro plus one lap — 7500 frames at 50 per second.
    expect(tuneIndexLengthLabel(record, false, SINGLE_SPEED_RATE)).toBe('2:30');
    expect(tuneIndexLoopStartLabel(record, false)).toBe((1500).toLocaleString());
    expect(tuneIndexLoopPeriodLabel(record, false, SINGLE_SPEED_RATE)).toBe('2:00');
  });

  it('derives the length from the rate in force, so the Timing selector moves it', () => {
    const record = fakeRecord({ loopPeriodFrames: 6000 });

    expect(tuneIndexLengthLabel(record, false, SINGLE_SPEED_RATE)).toBe('2:00');
    expect(tuneIndexLengthLabel(record, false, rateAt(2, 'rounded'))).toBe('1:00');
    expect(tuneIndexLengthLabel(record, false, rateAt(2.4))).toBe('0:50');
  });

  it('reads a tune that stops as ending rather than as a declined answer', () => {
    const record = fakeRecord({ loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: 6700 });

    expect(tuneIndexLengthLabel(record, false, SINGLE_SPEED_RATE)).toBe('2:14');
    expect(tuneIndexLoopStartLabel(record, false)).not.toBe('not found');
    expect(tuneIndexLoopPeriodLabel(record, false, SINGLE_SPEED_RATE)).toBe(
      tuneIndexLoopStartLabel(record, false)
    );
  });

  it('reads a declined answer as "not found" / "no clear key", not an error or a spinner', () => {
    const record = fakeRecord({
      loopStartFrame: null,
      loopPeriodFrames: null,
      endedAtFrame: null,
      tonic: null,
      mode: null,
      camelot: null,
      keyConfidence: 'none',
    });

    expect(tuneIndexLengthLabel(record, false, SINGLE_SPEED_RATE)).toBe('not found');
    expect(tuneIndexLoopStartLabel(record, false)).toBe('not found');
    expect(tuneIndexLoopPeriodLabel(record, false, SINGLE_SPEED_RATE)).toBe('not found');
    expect(tuneIndexKeyLabel(record, false)).toBe('no clear key');
    expect(tuneIndexKeyConfidenceLabel(record, false)).toBe('none');
  });

  it('switches from working to the known answer in place once the record lands, with no reload', () => {
    expect(tuneIndexLengthLabel(null, true, SINGLE_SPEED_RATE)).not.toBe('2:14');
    expect(tuneIndexLengthLabel(fakeRecord(), false, SINGLE_SPEED_RATE)).toBe('2:14');
  });

  it('flags a verified loop whose period is under fifteen seconds as implausible', () => {
    // 500 frames at 50 per second is 10 seconds — under the bar.
    const record = fakeRecord({ loopStartFrame: 0, loopPeriodFrames: 500 });

    expect(tuneIndexLoopIsImplausible(record, false, SINGLE_SPEED_RATE)).toBe(true);
  });

  it('does not flag a verified loop whose period is at or above fifteen seconds', () => {
    // 800 frames at 50 per second is 16 seconds — above the bar.
    const record = fakeRecord({ loopStartFrame: 0, loopPeriodFrames: 800 });

    expect(tuneIndexLoopIsImplausible(record, false, SINGLE_SPEED_RATE)).toBe(false);
  });

  it('flags neither a null record nor a tune that only ends', () => {
    expect(tuneIndexLoopIsImplausible(null, false, SINGLE_SPEED_RATE)).toBe(false);

    const ended = fakeRecord({ loopStartFrame: null, loopPeriodFrames: null, endedAtFrame: 100 });
    expect(tuneIndexLoopIsImplausible(ended, false, SINGLE_SPEED_RATE)).toBe(false);
  });
});
