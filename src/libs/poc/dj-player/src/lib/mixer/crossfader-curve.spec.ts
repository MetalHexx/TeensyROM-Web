import { describe, it, expect } from 'vitest';
import { linearCrossfaderGain } from './crossfader-curve';

describe('linearCrossfaderGain', () => {
  it('rests both sides at full gain when centred', () => {
    expect(linearCrossfaderGain(0, 'a')).toBe(1);
    expect(linearCrossfaderGain(0, 'b')).toBe(1);
  });

  it('takes side a to zero and leaves side b full at the hard-B extreme', () => {
    expect(linearCrossfaderGain(1, 'a')).toBe(0);
    expect(linearCrossfaderGain(1, 'b')).toBe(1);
  });

  it('takes side b to zero and leaves side a full at the hard-A extreme', () => {
    expect(linearCrossfaderGain(-1, 'a')).toBe(1);
    expect(linearCrossfaderGain(-1, 'b')).toBe(0);
  });

  it('is monotonic across the sweep — side a never rises, side b never falls', () => {
    const positions: number[] = [];
    for (let p = -1; p <= 1.0001; p += 0.05) positions.push(Math.min(p, 1));

    let previousA = linearCrossfaderGain(positions[0], 'a');
    let previousB = linearCrossfaderGain(positions[0], 'b');
    for (const position of positions.slice(1)) {
      const a = linearCrossfaderGain(position, 'a');
      const b = linearCrossfaderGain(position, 'b');
      expect(a).toBeLessThanOrEqual(previousA);
      expect(b).toBeGreaterThanOrEqual(previousB);
      previousA = a;
      previousB = b;
    }
  });

  it('clamps a position past hard-B to the same result as exactly 1', () => {
    expect(linearCrossfaderGain(5, 'a')).toBe(linearCrossfaderGain(1, 'a'));
    expect(linearCrossfaderGain(5, 'b')).toBe(linearCrossfaderGain(1, 'b'));
  });

  it('clamps a position past hard-A to the same result as exactly -1', () => {
    expect(linearCrossfaderGain(-5, 'a')).toBe(linearCrossfaderGain(-1, 'a'));
    expect(linearCrossfaderGain(-5, 'b')).toBe(linearCrossfaderGain(-1, 'b'));
  });

  it('produces a continuous gain off centre — not a multiple of the sixteen-step register grid', () => {
    const gain = linearCrossfaderGain(0.137, 'a');

    expect(gain).toBeCloseTo(0.863, 10);
    expect(Number.isInteger(gain * 15)).toBe(false);
  });
});
