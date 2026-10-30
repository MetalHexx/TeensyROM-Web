import { describe, it, expect } from 'vitest';
import { C64_COLOR_COUNT, C64_PALETTE, c64Color } from './c64-palette';

describe('c64Color', () => {
  it('resolves every index 0..15 to the palette entry with that index', () => {
    expect(C64_PALETTE).toHaveLength(C64_COLOR_COUNT);
    for (let index = 0; index < C64_COLOR_COUNT; index++) {
      expect(c64Color(index)?.index).toBe(index);
    }
  });

  it('returns the named color and hex for a known index', () => {
    expect(c64Color(14)).toEqual({ index: 14, name: 'Light Blue', hex: '#706DEB' });
  });

  it.each([16, -1, 1.5, Number.NaN])('returns undefined for %s', (index) => {
    expect(c64Color(index)).toBeUndefined();
  });
});
