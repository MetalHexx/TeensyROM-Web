import { describe, it, expect } from 'vitest';
import { keyMatchStateFor } from './key-match';

describe('keyMatchStateFor', () => {
  it.each([
    [7, 'full'],
    [6, 'close'],
    [5, 'possible'],
    [4, 'clash'],
    [0, 'clash'],
  ] as const)('maps %i shared notes to %s', (shared, state) => {
    expect(keyMatchStateFor(shared)).toBe(state);
  });
});
