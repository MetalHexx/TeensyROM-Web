import { describe, it, expect } from 'vitest';
import { keyDisplayFor } from './key-display';
import type { TuneIndexRecord } from '../analysis/tune-index.model';
import { TUNE_INDEX_FORMAT_VERSION } from '../analysis/tune-index.model';

function fakeRecord(overrides: Partial<TuneIndexRecord> = {}): TuneIndexRecord {
  return {
    filename: 'test.sid',
    subtune: 1,
    loopStartFrame: null,
    loopPeriodFrames: null,
    endedAtFrame: null,
    sectionBoundaries: [],
    detectedMoments: [],
    tonic: 1,
    mode: 'minor',
    camelot: '8B',
    tuningReferenceHz: 440,
    tuningCents: 0,
    keyConfidence: 'strong',
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

describe('keyDisplayFor', () => {
  it('renders the Camelot code as-is', () => {
    expect(keyDisplayFor(fakeRecord({ camelot: '8B' }), 'camelot')).toBe('8B');
  });

  it('renders a minor key as the pitch class plus "m"', () => {
    expect(keyDisplayFor(fakeRecord({ tonic: 1, mode: 'minor' }), 'note')).toBe('C#m');
  });

  it('renders a major key as the bare pitch class, no suffix', () => {
    expect(keyDisplayFor(fakeRecord({ tonic: 0, mode: 'major' }), 'note')).toBe('C');
  });

  it('falls back to null for no record at all', () => {
    expect(keyDisplayFor(null, 'camelot')).toBeNull();
    expect(keyDisplayFor(null, 'note')).toBeNull();
  });

  it('falls back to null when the record has no confident key', () => {
    const noKey = fakeRecord({ tonic: null, mode: null, camelot: null });

    expect(keyDisplayFor(noKey, 'camelot')).toBeNull();
    expect(keyDisplayFor(noKey, 'note')).toBeNull();
  });

  it('transposes the Camelot code by the given semitone offset', () => {
    // C# minor (tonic 1) + 3 semitones = E minor, which sits at 9A on the wheel.
    expect(keyDisplayFor(fakeRecord({ tonic: 1, mode: 'minor' }), 'camelot', 3)).toBe('9A');
  });

  it('transposes the note name by the given semitone offset, wrapping across the octave', () => {
    // B (tonic 11) + 2 semitones wraps to C# — the wraparound a naive tonic + offset would miss.
    expect(keyDisplayFor(fakeRecord({ tonic: 11, mode: 'major' }), 'note', 2)).toBe('C#');
  });

  it('transposes downward, wrapping negative', () => {
    // C minor (tonic 0) - 3 semitones wraps down to A minor.
    expect(keyDisplayFor(fakeRecord({ tonic: 0, mode: 'minor' }), 'note', -3)).toBe('Am');
  });

  it('a zero offset is equivalent to omitting it — the stored Camelot code, untransposed', () => {
    expect(keyDisplayFor(fakeRecord({ camelot: '8B' }), 'camelot', 0)).toBe('8B');
  });

  it('still falls back to null with no confident key, regardless of offset', () => {
    const noKey = fakeRecord({ tonic: null, mode: null, camelot: null });

    expect(keyDisplayFor(noKey, 'camelot', 5)).toBeNull();
  });
});
