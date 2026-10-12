import { describe, it, expect, vi } from 'vitest';
import {
  SID_FILTER_MODE_BAND_PASS,
  SID_FILTER_MODE_HIGH_PASS,
  SID_FILTER_MODE_LOW_PASS,
} from '@sidablist/core';
import {
  cutoffSweepDrives,
  FILTER_SWEEP,
  RESONANCE_SWEEP,
  resonanceDrive,
  tuneFilterStateFrom,
  type FieldDrive,
  type TuneFilterState,
} from './filter-sweep';

const CUTOFF_CEILING = 2047;
const OWN_TUNE: TuneFilterState = { filterType: 0, voice3Off: false };

function tuneOf(state: Partial<TuneFilterState> = {}): () => TuneFilterState {
  return () => ({ ...OWN_TUNE, ...state });
}

function driveFor(drives: readonly FieldDrive[], name: string, voice?: number): FieldDrive {
  const found = drives.find(
    (drive) =>
      drive.field.name === name &&
      (voice === undefined || ('voice' in drive.field && drive.field.voice === voice))
  );
  if (found === undefined) {
    throw new Error(`no drive for ${name}`);
  }
  return found;
}

function cutoffValue(position: number, state: Partial<TuneFilterState> = {}): number {
  const hold = driveFor(cutoffSweepDrives(position, tuneOf(state)), 'cutoff').hold;
  if (hold === null) {
    throw new Error('cutoff is released');
  }
  return hold.value;
}

/** Positions spanning the sweep region, outermost last. */
const SWEEP_POSITIONS = Array.from(
  { length: 41 },
  (_, i) =>
    FILTER_SWEEP.deadZone +
    FILTER_SWEEP.glideZone +
    (i / 40) * (1 - FILTER_SWEEP.deadZone - FILTER_SWEEP.glideZone)
);

describe('cutoffSweepDrives', () => {
  it('always returns five drives: cutoff, filter type, then the filtered flag of voices 0, 1 and 2', () => {
    for (const position of [-1, -0.5, -0.07, 0, 0.07, 0.5, 1]) {
      const drives = cutoffSweepDrives(position, tuneOf());

      expect(drives.map((drive) => drive.field)).toEqual([
        { name: 'cutoff' },
        { name: 'filterType' },
        { name: 'filtered', voice: 0 },
        { name: 'filtered', voice: 1 },
        { name: 'filtered', voice: 2 },
      ]);
    }
  });

  describe('centre', () => {
    it('releases every drive without ever reading the tune', () => {
      const tune = vi.fn(tuneOf());

      for (const position of [0, 0.02, -0.02, FILTER_SWEEP.deadZone, -FILTER_SWEEP.deadZone]) {
        const drives = cutoffSweepDrives(position, tune);

        expect(drives.every((drive) => drive.hold === null)).toBe(true);
      }
      expect(tune).not.toHaveBeenCalled();
    });
  });

  describe('left sweep', () => {
    const left = (travel: number): readonly FieldDrive[] => cutoffSweepDrives(-travel, tuneOf());

    it('holds low-pass with all three voices filtered', () => {
      const drives = left(0.6);

      expect(driveFor(drives, 'filterType').hold).toEqual({
        value: SID_FILTER_MODE_LOW_PASS,
        amount: 1,
      });
      for (const voice of [0, 1, 2]) {
        expect(driveFor(drives, 'filtered', voice).hold).toEqual({ value: 1, amount: 1 });
      }
    });

    it('lets the cutoff fall as the knob travels outward, never reaching zero', () => {
      const values = SWEEP_POSITIONS.map((travel) => cutoffValue(-travel));

      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
      }
      expect(values[0]).toBeGreaterThan(values[values.length - 1]);
      expect(Math.min(...values)).toBeGreaterThan(0);
    });
  });

  describe('right sweep', () => {
    it('holds high-pass with all three voices filtered', () => {
      const drives = cutoffSweepDrives(0.6, tuneOf());

      expect(driveFor(drives, 'filterType').hold).toEqual({
        value: SID_FILTER_MODE_HIGH_PASS,
        amount: 1,
      });
      for (const voice of [0, 1, 2]) {
        expect(driveFor(drives, 'filtered', voice).hold).toEqual({ value: 1, amount: 1 });
      }
    });

    it('lets the cutoff rise as the knob travels outward, never reaching the ceiling', () => {
      const values = SWEEP_POSITIONS.map((travel) => cutoffValue(travel));

      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
      expect(values[values.length - 1]).toBeGreaterThan(values[0]);
      expect(Math.max(...values)).toBeLessThan(CUTOFF_CEILING);
    });
  });

  describe('a tune that has voice 3 switched off', () => {
    it('releases voice 2 in the sweep while voices 0 and 1 stay held', () => {
      for (const position of [-0.6, 0.6]) {
        const drives = cutoffSweepDrives(position, tuneOf({ voice3Off: true }));

        expect(driveFor(drives, 'filtered', 2).hold).toBeNull();
        expect(driveFor(drives, 'filtered', 0).hold).not.toBeNull();
        expect(driveFor(drives, 'filtered', 1).hold).not.toBeNull();
      }
    });

    it('reads the tune once per call', () => {
      const tune = vi.fn(tuneOf());

      cutoffSweepDrives(0.6, tune);

      expect(tune).toHaveBeenCalledTimes(1);
    });
  });

  describe('glide', () => {
    const { deadZone, glideZone } = FILTER_SWEEP;
    const amountAt = (travel: number): number => {
      const hold = driveFor(cutoffSweepDrives(travel, tuneOf()), 'cutoff').hold;
      if (hold === null) {
        throw new Error('cutoff is released');
      }
      return hold.amount;
    };

    it('fades the cutoff hold in from nothing at the dead zone to full at the outer edge', () => {
      const justOutside = amountAt(deadZone + glideZone * 0.001);
      const middle = amountAt(deadZone + glideZone * 0.5);
      const justInside = amountAt(deadZone + glideZone * 0.999);

      expect(justOutside).toBeGreaterThan(0);
      expect(justOutside).toBeLessThan(0.01);
      expect(middle).toBeCloseTo(0.5, 5);
      expect(justInside).toBeGreaterThan(0.99);
      expect(amountAt(deadZone + glideZone)).toBe(1);
    });

    it('releases the switches while it holds the cutoff', () => {
      const drives = cutoffSweepDrives(deadZone + glideZone / 2, tuneOf());

      expect(driveFor(drives, 'filterType').hold).toBeNull();
      for (const voice of [0, 1, 2]) {
        expect(driveFor(drives, 'filtered', voice).hold).toBeNull();
      }
      expect(driveFor(drives, 'cutoff').hold).not.toBeNull();
    });

    it.each([
      ['no filter type', 0, CUTOFF_CEILING],
      ['low-pass', SID_FILTER_MODE_LOW_PASS, CUTOFF_CEILING],
      ['high-pass', SID_FILTER_MODE_HIGH_PASS, 0],
    ])('opens the cutoff fully for a tune with %s', (_label, filterType, expected) => {
      for (const side of [-1, 1]) {
        expect(cutoffValue(side * (deadZone + glideZone / 2), { filterType })).toBe(expected);
      }
    });

    it('opens the cutoff at the sweep’s own open value for a band-pass or mixed tune', () => {
      for (const filterType of [
        SID_FILTER_MODE_BAND_PASS,
        SID_FILTER_MODE_LOW_PASS | SID_FILTER_MODE_BAND_PASS,
      ]) {
        expect(cutoffValue(-(deadZone + glideZone / 2), { filterType })).toBe(
          FILTER_SWEEP.lowPass.openCutoff
        );
        expect(cutoffValue(deadZone + glideZone / 2, { filterType })).toBe(
          FILTER_SWEEP.highPass.openCutoff
        );
      }
    });
  });

  it('never drives the external filter input and only holds integers', () => {
    const positions = [
      -1, -0.9, -0.5, -0.141, -0.139, -0.07, -0.041, 0, 0.041, 0.07, 0.139, 0.141, 0.5, 0.9, 1, 2,
      -2,
    ];

    for (const position of positions) {
      for (const drive of cutoffSweepDrives(position, tuneOf())) {
        expect(drive.field.name).not.toBe('externalFiltered');
        if (drive.hold !== null) {
          expect(Number.isInteger(drive.hold.value)).toBe(true);
        }
      }
    }
  });
});

describe('resonanceDrive', () => {
  const heldAt = (position: number): { readonly value: number; readonly amount: number } => {
    const { hold } = resonanceDrive(position);
    if (hold === null) {
      throw new Error('resonance is released');
    }
    return hold;
  };

  it('drives the resonance field', () => {
    expect(resonanceDrive(0.5).field).toEqual({ name: 'resonance' });
  });

  it('releases at rest, and for anything below it', () => {
    expect(resonanceDrive(0).hold).toBeNull();
    expect(resonanceDrive(-0.5).hold).toBeNull();
  });

  it('rises without falling and reaches the field maximum at full travel', () => {
    const values = Array.from({ length: 21 }, (_, i) => heldAt(0.001 + (i / 20) * 0.999).value);

    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
    expect(heldAt(1).value).toBe(15);
    expect(heldAt(2).value).toBe(15);
    expect(Number.isInteger(heldAt(0.37).value)).toBe(true);
  });

  it('blends in over the glide stretch and stays full after it', () => {
    const { glideStretch } = RESONANCE_SWEEP;

    expect(heldAt(glideStretch / 2).amount).toBeCloseTo(0.5, 5);
    expect(heldAt(0.001).amount).toBeLessThan(0.01);
    expect(heldAt(glideStretch).amount).toBe(1);
    expect(heldAt(0.6).amount).toBe(1);
    expect(heldAt(1).amount).toBe(1);
  });
});

describe('tuneFilterStateFrom', () => {
  function registers(volumeAndMode: number): Uint8Array {
    const written = new Uint8Array(25);
    written[24] = volumeAndMode;
    return written;
  }

  it('reads the filter type from bits 6–4 of $D418', () => {
    expect(tuneFilterStateFrom(registers(0x4f)).filterType).toBe(SID_FILTER_MODE_HIGH_PASS);
    expect(tuneFilterStateFrom(registers(0x1f)).filterType).toBe(SID_FILTER_MODE_LOW_PASS);
    expect(tuneFilterStateFrom(registers(0x0f)).filterType).toBe(0);
  });

  it('reads voice 3 off from bit 7 of $D418', () => {
    expect(tuneFilterStateFrom(registers(0x80)).voice3Off).toBe(true);
    expect(tuneFilterStateFrom(registers(0x7f)).voice3Off).toBe(false);
  });
});
