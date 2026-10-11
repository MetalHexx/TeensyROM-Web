import { describe, it, expect } from 'vitest';
import { keyDisplayFor } from './key-display';
import type { DeckDetectedKey } from '../dj-store';

function fakeKey(overrides: Partial<DeckDetectedKey> = {}): DeckDetectedKey {
  return { tonic: 1, mode: 'minor', camelot: '8B', ...overrides };
}

describe('keyDisplayFor', () => {
  it('renders the Camelot code as-is', () => {
    expect(keyDisplayFor(fakeKey({ camelot: '8B' }), 'camelot')).toBe('8B');
  });

  it('renders a minor key as the pitch class plus "m"', () => {
    expect(keyDisplayFor(fakeKey({ tonic: 1, mode: 'minor' }), 'note')).toBe('C#m');
  });

  it('renders a major key as the bare pitch class, no suffix', () => {
    expect(keyDisplayFor(fakeKey({ tonic: 0, mode: 'major' }), 'note')).toBe('C');
  });

  it('falls back to null for no detected key at all', () => {
    expect(keyDisplayFor(null, 'camelot')).toBeNull();
    expect(keyDisplayFor(null, 'note')).toBeNull();
  });

  it('transposes the Camelot code by the given semitone offset', () => {
    // C# minor (tonic 1) + 3 semitones = E minor, which sits at 9A on the wheel.
    expect(keyDisplayFor(fakeKey({ tonic: 1, mode: 'minor' }), 'camelot', 3)).toBe('9A');
  });

  it('transposes the note name by the given semitone offset, wrapping across the octave', () => {
    // B (tonic 11) + 2 semitones wraps to C# — the wraparound a naive tonic + offset would miss.
    expect(keyDisplayFor(fakeKey({ tonic: 11, mode: 'major' }), 'note', 2)).toBe('C#');
  });

  it('transposes downward, wrapping negative', () => {
    // C minor (tonic 0) - 3 semitones wraps down to A minor.
    expect(keyDisplayFor(fakeKey({ tonic: 0, mode: 'minor' }), 'note', -3)).toBe('Am');
  });

  it('a zero offset is equivalent to omitting it — the stored Camelot code, untransposed', () => {
    expect(keyDisplayFor(fakeKey({ camelot: '8B' }), 'camelot', 0)).toBe('8B');
  });

  it('still falls back to null with no detected key, regardless of offset', () => {
    expect(keyDisplayFor(null, 'camelot', 5)).toBeNull();
  });
});
