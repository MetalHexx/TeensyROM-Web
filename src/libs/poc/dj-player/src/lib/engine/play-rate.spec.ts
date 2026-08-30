import { describe, it, expect } from 'vitest';
import { PAL_FRAME_INTERVAL_US } from '../asid/asid-constants';
import { C64Machine } from '../cpu/c64-machine';
import { RegisterFrame } from '../asid/register-frame';
import type { SidFile } from '../sid/sid-file.model';
import {
  asRounded,
  msToPlayCalls,
  playCallIntervalUs,
  playCallsPerSecond,
  playCallsToSeconds,
  playRateFor,
} from './play-rate';
import type { PlayRate } from './play-rate';

interface CodeBlock {
  readonly at: number;
  readonly bytes: readonly number[];
}

function tune(blocks: readonly CodeBlock[]): SidFile {
  const loadAddress = 0x1000;
  const codeEnd = blocks.reduce((end, block) => Math.max(end, block.at + block.bytes.length), loadAddress);
  const data = new Uint8Array(codeEnd - loadAddress);
  for (const block of blocks) {
    data.set(block.bytes, block.at - loadAddress);
  }
  return {
    format: 'PSID',
    version: 2,
    loadAddress,
    initAddress: loadAddress,
    playAddress: 0x1010,
    songs: 1,
    startSong: 1,
    speedFlags: 0,
    name: '',
    author: '',
    released: '',
    clock: 'pal',
    model: 'unknown',
    secondSidAddress: null,
    thirdSidAddress: null,
    data,
  };
}

const RTS = 0x60;

/** Programs CIA 1 timer A for a latch giving exactly 2.4 calls per frame at PAL — a rate that does
 *  not divide the frame evenly, unlike the 4.0-calls-per-frame latch `c64-machine.spec.ts`'s own
 *  rate test uses, which could never expose a rounding defect. Mirrors that spec's own fractional
 *  latch (`$1FFD`, 8190 cycles per call). */
function fractionalRateMachine(): C64Machine {
  const file = tune([
    { at: 0x1000, bytes: [0xa9, 0xfd, 0x8d, 0x04, 0xdc, 0xa9, 0x1f, 0x8d, 0x05, 0xdc, RTS] },
    { at: 0x1010, bytes: [RTS] },
  ]);
  const machine = new C64Machine(file, new RegisterFrame());
  machine.initSubtune(1);
  return machine;
}

/** No CIA timer programmed — both rates fall back to 1. */
function unitRateMachine(): C64Machine {
  const file = tune([
    { at: 0x1000, bytes: [RTS] },
    { at: 0x1010, bytes: [RTS] },
  ]);
  const machine = new C64Machine(file, new RegisterFrame());
  machine.initSubtune(1);
  return machine;
}

describe('playRateFor', () => {
  it('reports the exact and rounded rates genuinely disagreeing for a fractional CIA latch', () => {
    const machine = fractionalRateMachine();

    const exact = playRateFor(machine, 'exact');
    const rounded = playRateFor(machine, 'rounded');

    expect(exact.exactCallsPerFrame).toBeCloseTo(2.4, 5);
    expect(exact.roundedCallsPerFrame).toBe(2);
    expect(exact.callsPerFrame).toBeCloseTo(2.4, 5);
    expect(rounded.exactCallsPerFrame).toBeCloseTo(2.4, 5);
    expect(rounded.roundedCallsPerFrame).toBe(2);
    expect(rounded.callsPerFrame).toBe(2);
  });

  it('reports 1 for every rate on a tune with no CIA timer programmed', () => {
    const machine = unitRateMachine();

    const rate = playRateFor(machine, 'exact');

    expect(rate.exactCallsPerFrame).toBe(1);
    expect(rate.roundedCallsPerFrame).toBe(1);
    expect(rate.callsPerFrame).toBe(1);
  });

  it('reports 1 for every rate with no machine loaded, under either mode', () => {
    expect(playRateFor(null, 'exact')).toEqual({
      callsPerFrame: 1,
      exactCallsPerFrame: 1,
      roundedCallsPerFrame: 1,
      mode: 'exact',
    });
    expect(playRateFor(null, 'rounded')).toEqual({
      callsPerFrame: 1,
      exactCallsPerFrame: 1,
      roundedCallsPerFrame: 1,
      mode: 'rounded',
    });
  });
});

describe('asRounded', () => {
  it('forces callsPerFrame to the rounded rate and relabels the mode, leaving both source rates untouched', () => {
    const machine = fractionalRateMachine();
    const exact = playRateFor(machine, 'exact');

    const rounded = asRounded(exact);

    expect(rounded.mode).toBe('rounded');
    expect(rounded.callsPerFrame).toBe(2);
    expect(rounded.exactCallsPerFrame).toBeCloseTo(2.4, 5);
    expect(rounded.roundedCallsPerFrame).toBe(2);
  });
});

describe('playCallIntervalUs', () => {
  it('divides the nominal interval by the rate in force', () => {
    const machine = fractionalRateMachine();
    const exact = playRateFor(machine, 'exact');
    const rounded = playRateFor(machine, 'rounded');

    expect(playCallIntervalUs(PAL_FRAME_INTERVAL_US, exact)).toBeCloseTo(PAL_FRAME_INTERVAL_US / 2.4, 6);
    expect(playCallIntervalUs(PAL_FRAME_INTERVAL_US, rounded)).toBeCloseTo(PAL_FRAME_INTERVAL_US / 2, 6);
  });

  it('falls back to the PAL nominal interval for a non-finite or non-positive interval, never Infinity or NaN', () => {
    const rate: PlayRate = { callsPerFrame: 2, exactCallsPerFrame: 2, roundedCallsPerFrame: 2, mode: 'exact' };

    for (const bad of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = playCallIntervalUs(bad, rate);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeCloseTo(PAL_FRAME_INTERVAL_US / 2, 6);
    }
  });
});

describe('msToPlayCalls', () => {
  it('converts a real-time duration to a whole number of play calls at the rate in force', () => {
    const unitRate: PlayRate = { callsPerFrame: 1, exactCallsPerFrame: 1, roundedCallsPerFrame: 1, mode: 'exact' };

    expect(msToPlayCalls(1000, PAL_FRAME_INTERVAL_US, unitRate)).toBe(
      Math.round((1000 * 1000) / PAL_FRAME_INTERVAL_US)
    );
  });

  it('scales with the fractional rate rather than the rounded one under exact mode', () => {
    const machine = fractionalRateMachine();
    const exact = playRateFor(machine, 'exact');
    const rounded = playRateFor(machine, 'rounded');

    const exactCalls = msToPlayCalls(1000, PAL_FRAME_INTERVAL_US, exact);
    const roundedCalls = msToPlayCalls(1000, PAL_FRAME_INTERVAL_US, rounded);

    expect(exactCalls).toBe(Math.round((1000 * 1000 * 2.4) / PAL_FRAME_INTERVAL_US));
    expect(roundedCalls).toBe(Math.round((1000 * 1000 * 2) / PAL_FRAME_INTERVAL_US));
    expect(exactCalls).not.toBe(roundedCalls);
  });

  it('never produces NaN for a non-finite or non-positive nominal interval', () => {
    const rate: PlayRate = { callsPerFrame: 1, exactCallsPerFrame: 1, roundedCallsPerFrame: 1, mode: 'exact' };

    for (const bad of [0, -1, Number.NaN]) {
      expect(Number.isFinite(msToPlayCalls(1000, bad, rate))).toBe(true);
    }
  });
});

describe('playCallsToSeconds and playCallsPerSecond', () => {
  it('are inverses of one another at a given nominal interval and rate', () => {
    const machine = fractionalRateMachine();
    const rate = playRateFor(machine, 'exact');

    const perSecond = playCallsPerSecond(PAL_FRAME_INTERVAL_US, rate);
    const seconds = playCallsToSeconds(perSecond, PAL_FRAME_INTERVAL_US, rate);

    expect(seconds).toBeCloseTo(1, 6);
  });

  it('doubles play calls per second for a callsPerFrame 2 tune versus callsPerFrame 1, at the same nominal interval', () => {
    const unitRate: PlayRate = { callsPerFrame: 1, exactCallsPerFrame: 1, roundedCallsPerFrame: 1, mode: 'exact' };
    const doubleRate: PlayRate = { callsPerFrame: 2, exactCallsPerFrame: 2, roundedCallsPerFrame: 2, mode: 'exact' };

    expect(playCallsPerSecond(PAL_FRAME_INTERVAL_US, doubleRate)).toBeCloseTo(
      playCallsPerSecond(PAL_FRAME_INTERVAL_US, unitRate) * 2,
      6
    );
  });

  it('falls back to the PAL nominal interval rather than producing Infinity or NaN', () => {
    const rate: PlayRate = { callsPerFrame: 1, exactCallsPerFrame: 1, roundedCallsPerFrame: 1, mode: 'exact' };

    for (const bad of [0, -50, Number.NaN]) {
      expect(Number.isFinite(playCallsPerSecond(bad, rate))).toBe(true);
      expect(Number.isFinite(playCallsToSeconds(10, bad, rate))).toBe(true);
    }
  });
});
