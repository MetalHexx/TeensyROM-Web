import { describe, expect, it } from 'vitest';
import { parseWaveColour } from './wave-colour';

describe('parseWaveColour', () => {
  it.each([
    ['#f0a', [255, 0, 170]],
    ['#F0A8', [255, 0, 170]],
    ['#08060a', [8, 6, 10]],
    ['  #ff00AA80 ', [255, 0, 170]],
    ['rgb(255, 0, 170)', [255, 0, 170]],
    ['rgba(255,0,170,0.5)', [255, 0, 170]],
    ['rgb(255 0 170 / 50%)', [255, 0, 170]],
    ['rgb(100%, 0%, 50%)', [255, 0, 128]],
    ['rgb(300, -4, 12.6)', [255, 0, 13]],
  ] as [string, number[]][])('reads %s', (css, expected) => {
    expect(parseWaveColour(css)).toEqual(expected);
  });

  it.each(['', 'red', '#12', '#12345', '#gggggg', 'rgb(1, 2)', 'rgb(a, b, c)', 'hsl(0, 100%, 50%)', 'var(--x)', 'rgb(1 2 3 4 5)'])(
    'rejects %j',
    (css) => {
      expect(parseWaveColour(css)).toBeNull();
    }
  );
});
