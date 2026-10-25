import { describe, it, expect } from 'vitest';
import { formatElapsed, formatSeconds, formatTotal } from './transport-time';

/** A 50 Hz tune's play-call interval, in whole microseconds. */
const INTERVAL_US = 20_000;

describe('formatElapsed', () => {
  it('reads 00:00.0 while the interval is unknown, whatever the frame count', () => {
    expect(formatElapsed(0, null)).toBe('00:00.0');
    expect(formatElapsed(5_000, null)).toBe('00:00.0');
  });

  it('reads 00:00.0 at the start and for a position that is not a usable count', () => {
    expect(formatElapsed(0, INTERVAL_US)).toBe('00:00.0');
    expect(formatElapsed(-5, INTERVAL_US)).toBe('00:00.0');
    expect(formatElapsed(Number.NaN, INTERVAL_US)).toBe('00:00.0');
    expect(formatElapsed(100, 0)).toBe('00:00.0');
  });

  it('shows minutes, seconds and tenths', () => {
    // 3 min 5.4 s
    expect(formatElapsed(9_270, INTERVAL_US)).toBe('03:05.4');
  });

  it('truncates the tenths, so 59.95 s reads 00:59.9 and never rolls ahead of the playhead', () => {
    expect(formatElapsed(59_950, 1_000)).toBe('00:59.9');
    expect(formatElapsed(59_999, 1_000)).toBe('00:59.9');
    expect(formatElapsed(60_000, 1_000)).toBe('01:00.0');
  });

  it('does not cap minutes past an hour or past 99', () => {
    expect(formatElapsed(200_000, INTERVAL_US)).toBe('66:40.0');
    expect(formatElapsed(300_000, INTERVAL_US)).toBe('100:00.0');
  });
});

describe('formatTotal', () => {
  it('reads --:-- when either the length or the interval is unknown', () => {
    expect(formatTotal(null, INTERVAL_US)).toBe('--:--');
    expect(formatTotal(9_000, null)).toBe('--:--');
    expect(formatTotal(null, null)).toBe('--:--');
  });

  it('shows minutes and seconds', () => {
    expect(formatTotal(9_000, INTERVAL_US)).toBe('03:00');
    expect(formatTotal(0, INTERVAL_US)).toBe('00:00');
  });

  it('truncates the seconds and does not cap minutes', () => {
    expect(formatTotal(59_950, 1_000)).toBe('00:59');
    expect(formatTotal(300_000, INTERVAL_US)).toBe('100:00');
  });
});

describe('formatSeconds', () => {
  it('reads 0.0s while the interval is unknown or the count is not usable', () => {
    expect(formatSeconds(390, null)).toBe('0.0s');
    expect(formatSeconds(0, INTERVAL_US)).toBe('0.0s');
    expect(formatSeconds(-5, INTERVAL_US)).toBe('0.0s');
    expect(formatSeconds(Number.NaN, INTERVAL_US)).toBe('0.0s');
  });

  it('shows seconds to the tenth', () => {
    expect(formatSeconds(390, INTERVAL_US)).toBe('7.8s');
    expect(formatSeconds(50, INTERVAL_US)).toBe('1.0s');
  });

  it('truncates the tenths and does not roll into minutes', () => {
    expect(formatSeconds(1_999, 1_000)).toBe('1.9s');
    expect(formatSeconds(75_000, 1_000)).toBe('75.0s');
  });
});
