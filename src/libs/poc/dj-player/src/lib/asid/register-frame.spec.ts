import { describe, it, expect, beforeAll } from 'vitest';
import { RegisterFrame } from './register-frame';
import type { FrameSnapshot, SidFilterMode } from './register-frame';
import { ASID_SLOT_COUNT } from './asid-constants';
import { clamp } from '../engine/engine-utils';
import { C64Machine } from '../cpu/c64-machine';
import type { SidFile } from '../sid/sid-file.model';
import { parseSidFile } from '../sid/sid-file.parser';
import { BUNDLED_TUNES, decodeBundledTune } from '../sid/bundled';

/** SID register -> primary ASID slot, transcribed from the same table as `asid-constants.ts`. */
const PRIMARY_SLOT_FOR_REGISTER: readonly number[] = [
  0, 1, 2, 3, 22, 4, 5, 6, 7, 8, 9, 23, 10, 11, 12, 13, 14, 15, 24, 16, 17, 18, 19, 20, 21,
];

describe('RegisterFrame', () => {
  it('maps every SID register onto its documented primary slot', () => {
    for (let register = 0; register <= 24; register++) {
      const frame = new RegisterFrame();
      frame.onSidWrite(register, 0x33);

      const snapshot = frame.takeSnapshot();
      const slot = PRIMARY_SLOT_FOR_REGISTER[register];
      const byteIndex = Math.floor(slot / 7);
      const bit = 1 << slot % 7;

      expect(snapshot.presentMask[byteIndex] & bit).toBe(bit);
      expect(snapshot.presentMask.reduce((sum, byte) => sum + popcount(byte), 0)).toBe(1);
      expect(snapshot.values).toEqual([0x33]);
    }
  });

  it('sets the MSB mask bit and transmits only the low 7 bits for a value >= 0x80', () => {
    const frame = new RegisterFrame();
    frame.onSidWrite(2, 0xab);

    const snapshot = frame.takeSnapshot();

    // register 2 -> slot 2 -> byte 0, bit 2
    expect(snapshot.presentMask[0] & 0b100).toBe(0b100);
    expect(snapshot.msbMask[0] & 0b100).toBe(0b100);
    expect(snapshot.values).toEqual([0xab & 0x7f]);
  });

  it('does not set the MSB mask bit for a value under 0x80', () => {
    const frame = new RegisterFrame();
    frame.onSidWrite(2, 0x33);

    const snapshot = frame.takeSnapshot();

    expect(snapshot.msbMask).toEqual([0, 0, 0, 0]);
  });

  it.each([4, 11, 18])(
    'carries both writes to gate register %d in one frame, in the primary and secondary slot',
    (register) => {
      const frame = new RegisterFrame();
      frame.onSidWrite(register, 0x10);
      frame.onSidWrite(register, 0x20);

      const snapshot = frame.takeSnapshot();

      expect(snapshot.values).toEqual([0x10, 0x20]);
      expect(frame.suppressedWriteCount).toBe(0);
    }
  );

  it('overwrites the first write with the second for a register with no secondary slot, and counts it', () => {
    const frame = new RegisterFrame();
    frame.onSidWrite(0, 0x10);
    frame.onSidWrite(0, 0x20);

    const snapshot = frame.takeSnapshot();

    expect(snapshot.values).toEqual([0x20]);
    expect(frame.suppressedWriteCount).toBe(1);
  });

  it('accumulates the suppressed-write count across frames instead of resetting it on snapshot', () => {
    const frame = new RegisterFrame();
    frame.onSidWrite(0, 0x10);
    frame.onSidWrite(0, 0x20);
    frame.takeSnapshot();
    frame.onSidWrite(1, 0x10);
    frame.onSidWrite(1, 0x20);
    frame.takeSnapshot();

    expect(frame.suppressedWriteCount).toBe(2);
  });

  it('produces an empty snapshot for a frame with no writes', () => {
    const frame = new RegisterFrame();

    const snapshot = frame.takeSnapshot();

    expect(snapshot.presentMask).toEqual([0, 0, 0, 0]);
    expect(snapshot.msbMask).toEqual([0, 0, 0, 0]);
    expect(snapshot.values).toEqual([]);
  });

  it('clears dirty state on snapshot so an untouched next frame is empty again', () => {
    const frame = new RegisterFrame();
    frame.onSidWrite(0, 0x10);
    frame.takeSnapshot();

    const snapshot = frame.takeSnapshot();

    expect(snapshot.presentMask).toEqual([0, 0, 0, 0]);
    expect(snapshot.values).toEqual([]);
  });

  it('resets per-frame second-write tracking on snapshot, so the next frame is not suppressed', () => {
    const frame = new RegisterFrame();
    frame.onSidWrite(0, 0x10);
    frame.onSidWrite(0, 0x20);
    frame.takeSnapshot();

    frame.onSidWrite(0, 0x30);
    const snapshot = frame.takeSnapshot();

    expect(snapshot.values).toEqual([0x30]);
    expect(frame.suppressedWriteCount).toBe(1);
  });

  it('marks all 25 registers dirty without touching the secondary gate slots', () => {
    const frame = new RegisterFrame();

    frame.markAllDirty();
    const snapshot = frame.takeSnapshot();

    expect(snapshot.values).toHaveLength(25);
    expect(snapshot.values.every((value) => value === 0)).toBe(true);
    expect(snapshot.presentMask).toEqual([0x7f, 0x7f, 0x7f, 0x0f]);
  });

  it('reflects a register value already written before markAllDirty', () => {
    const frame = new RegisterFrame();
    frame.onSidWrite(24, 0x42);
    frame.takeSnapshot();

    frame.markAllDirty();
    const snapshot = frame.takeSnapshot();

    // register 24 -> slot 21 -> the 22nd present slot in ascending order
    expect(snapshot.values[21]).toBe(0x42);
  });

  describe('voice mute', () => {
    it('forces the control register to 0 in the very next snapshot on mute-engage', () => {
      const frame = new RegisterFrame();

      frame.setVoiceMuted(1, true);
      const snapshot = frame.takeSnapshot();

      // voice 1's control register is $D40B (register 11) -> primary slot 23 -> byte 3, bit 2
      expect(snapshot.values).toEqual([0]);
      expect(snapshot.presentMask[3] & 0b100).toBe(0b100);
    });

    it('suppresses further writes to a muted voice control register but not its secondary slot sibling registers', () => {
      const frame = new RegisterFrame();

      frame.setVoiceMuted(1, true);
      frame.takeSnapshot();

      frame.onSidWrite(11, 0x41); // muted control register — dropped
      frame.onSidWrite(9, 0x77); // voice 1's pulse-width-lo register — unaffected
      const snapshot = frame.takeSnapshot();

      expect(snapshot.values).toEqual([0x77]);
    });

    it('lets a subsequent write through unmodified after unmuting', () => {
      const frame = new RegisterFrame();

      frame.setVoiceMuted(1, true);
      frame.takeSnapshot();
      frame.setVoiceMuted(1, false);

      frame.onSidWrite(11, 0x41);
      const snapshot = frame.takeSnapshot();

      expect(snapshot.values).toEqual([0x41]);
    });

    it('unmuting forces no extra write of its own', () => {
      const frame = new RegisterFrame();

      frame.setVoiceMuted(1, true);
      frame.takeSnapshot();
      frame.setVoiceMuted(1, false);

      const snapshot = frame.takeSnapshot();

      expect(snapshot.values).toEqual([]);
    });

    it('muting an already-muted voice is a no-op', () => {
      const frame = new RegisterFrame();

      frame.setVoiceMuted(1, true);
      frame.takeSnapshot();
      frame.setVoiceMuted(1, true);

      const snapshot = frame.takeSnapshot();

      expect(snapshot.values).toEqual([]);
    });

    it('unmuting an already-unmuted voice is a no-op', () => {
      const frame = new RegisterFrame();

      frame.setVoiceMuted(1, false);

      const snapshot = frame.takeSnapshot();

      expect(snapshot.values).toEqual([]);
    });
  });

  describe('output gain scaling ($D418, register 24)', () => {
    it('scales only the low nibble, leaving every filter-mode/voice-3-mute combination untouched', () => {
      for (let highNibble = 0; highNibble <= 0xf; highNibble++) {
        const frame = new RegisterFrame();
        frame.onSidWrite(24, (highNibble << 4) | 0x0a); // low nibble 10
        frame.setOutputGain(0.5);

        const snapshot = frame.takeSnapshot();

        expect(volumeByteFromSnapshot(snapshot)).toBe((highNibble << 4) | Math.round(10 * 0.5));
      }
    });

    it('rounds gain 0 to silence and leaves gain 1 byte-for-byte unchanged', () => {
      const silenced = new RegisterFrame();
      silenced.onSidWrite(24, 0x3f);
      silenced.setOutputGain(0);
      expect(volumeByteFromSnapshot(silenced.takeSnapshot())).toBe(0x30);

      const unchanged = new RegisterFrame();
      unchanged.onSidWrite(24, 0x3f);
      unchanged.setOutputGain(1);
      expect(volumeByteFromSnapshot(unchanged.takeSnapshot())).toBe(0x3f);
    });

    it('rounds a mid-gain value up when past the half boundary and down when short of it', () => {
      const roundsDown = new RegisterFrame();
      roundsDown.onSidWrite(24, 0x02); // low nibble 2 at gain 0.6 -> 1.2, rounds down to 1
      roundsDown.setOutputGain(0.6);
      expect(volumeByteFromSnapshot(roundsDown.takeSnapshot()) & 0x0f).toBe(1);

      const roundsUp = new RegisterFrame();
      roundsUp.onSidWrite(24, 0x03); // low nibble 3 at gain 0.6 -> 1.8, rounds up to 2
      roundsUp.setOutputGain(0.6);
      expect(volumeByteFromSnapshot(roundsUp.takeSnapshot()) & 0x0f).toBe(2);
    });

    it('carries the volume slot present with no $D418 write at all, once gain is off unity', () => {
      const frame = new RegisterFrame();
      frame.takeSnapshot(); // establish an empty frame — the raw value defaults to 0
      frame.setOutputGain(0.5);

      const snapshot = frame.takeSnapshot();

      expect(snapshot.presentMask[3] & 0b1).toBe(0b1);
      expect(snapshot.values).toEqual([0]);
    });

    it('keeps forcing the volume slot present every frame while gain stays off unity, with no rewrite', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(24, 0x2f); // written once, never rewritten again
      frame.setOutputGain(0.5);
      frame.takeSnapshot();

      const second = frame.takeSnapshot();
      const third = frame.takeSnapshot();

      expect(second.presentMask[3] & 0b1).toBe(0b1);
      expect(third.presentMask[3] & 0b1).toBe(0b1);
      expect(volumeByteFromSnapshot(second) & 0x0f).toBe(Math.round(0x0f * 0.5));
      expect(volumeByteFromSnapshot(third) & 0x0f).toBe(Math.round(0x0f * 0.5));
    });

    it('carries the volume slot once more on the return to exactly unity, to restore the full value', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(24, 0x2f);
      frame.setOutputGain(0.5);
      frame.takeSnapshot(); // consumes the "off unity" presence

      frame.setOutputGain(1);
      const restoreSnapshot = frame.takeSnapshot();
      expect(restoreSnapshot.presentMask[3] & 0b1).toBe(0b1);
      expect(volumeByteFromSnapshot(restoreSnapshot)).toBe(0x2f);

      const next = frame.takeSnapshot();
      expect(next.presentMask[3] & 0b1).toBe(0);
    });

    it('never forces the volume slot present while the fader stays at unity', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(24, 0x2f);
      frame.takeSnapshot();

      const snapshot = frame.takeSnapshot();

      expect(snapshot.presentMask[3] & 0b1).toBe(0);
    });

    it('survives a discarded snapshot between a gain change and the next emitted frame, without swallowing the fader move', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(24, 0x2f);
      frame.setOutputGain(0.5);

      // Mirrors auditionMarkerEnd's own discarded takeSnapshot() call, made purely to reset
      // per-frame duplicate-write tracking.
      frame.takeSnapshot();

      const emitted = frame.takeSnapshot();
      expect(emitted.presentMask[3] & 0b1).toBe(0b1);
      expect(volumeByteFromSnapshot(emitted) & 0x0f).toBe(Math.round(0x0f * 0.5));
    });

    it('leaves the suppressed-write count untouched across a swept fade', () => {
      const frame = new RegisterFrame();
      for (let i = 0; i < 5; i++) {
        frame.onSidWrite(24, 0x20 + i);
        frame.setOutputGain(i / 4);
        frame.takeSnapshot();
      }

      expect(frame.suppressedWriteCount).toBe(0);
    });

    it('keeps snapshotValues() raw, never gain-scaled', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(24, 0x2f);
      frame.setOutputGain(0.5);

      expect(frame.snapshotValues().values[21]).toBe(0x2f); // register 24 -> primary slot 21
    });

    it('keeps the all-dirty snapshot at one entry per slot in ascending order with gain applied', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(24, 0x1f);
      frame.setOutputGain(0.5);

      frame.markAllDirty();
      const snapshot = frame.takeSnapshot();

      expect(snapshot.values).toHaveLength(25);
      // slot 21 -> the 22nd present slot in ascending order, register 24's primary slot
      expect(snapshot.values[21] & 0x0f).toBe(Math.round(0x0f * 0.5));
    });

    it('does not double-apply gain to a cue captured at one fader position and re-entered at another', () => {
      const source = new RegisterFrame();
      source.onSidWrite(24, 0x2f);
      source.setOutputGain(0.5);
      const cue = source.snapshotValues(); // raw values only, per snapshotValues()'s own contract

      const target = new RegisterFrame();
      target.restoreValues(cue);
      target.setOutputGain(0.25);
      target.markAllDirty();

      const snapshot = target.takeSnapshot();
      expect(snapshot.values[21] & 0x0f).toBe(Math.round(0x0f * 0.25));
    });
  });

  describe('the generalized register scaling stage', () => {
    const CUTOFF_LOW = 21;
    const CUTOFF_HIGH = 22;
    const RESONANCE = 23;
    const VOLUME = 24;
    /** [low, high] register pairs per voice. */
    const PULSE_WIDTH_REGISTERS = [
      [2, 3],
      [9, 10],
      [16, 17],
    ];
    const FREQUENCY_REGISTERS = [
      [0, 1],
      [7, 8],
      [14, 15],
    ];

    it('passes every register through byte-for-byte with every control at home', () => {
      const frame = new RegisterFrame();
      const written = new Map<number, number>();
      for (let register = 0; register <= 24; register++) {
        const value = (register * 11 + 0x37) & 0xff;
        written.set(register, value);
        frame.onSidWrite(register, value);
      }

      const snapshot = frame.takeSnapshot();

      for (const [register, value] of written) {
        expect(transmittedByteForRegister(snapshot, register)).toBe(value);
      }
    });

    it('combines the 11-bit cutoff, rounds it once and splits it back, sparing register 21s upper bits', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(CUTOFF_LOW, 0xff); // cutoff bits 0-2 = 7, upper five bits all set
      frame.onSidWrite(CUTOFF_HIGH, 0x65); // combined = (101 << 3) | 7 = 815

      frame.setRegisterScale('cutoff', 0.5);
      const snapshot = frame.takeSnapshot();

      // 815 * 0.5 = 407.5 -> 408. Scaling byte-at-a-time would land the low bits on 4, not 0.
      expect(transmittedByteForRegister(snapshot, CUTOFF_HIGH)).toBe(0x33);
      expect(transmittedByteForRegister(snapshot, CUTOFF_LOW)).toBe(0xf8);
    });

    it('saturates cutoff at its 11-bit ceiling rather than wrapping', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(CUTOFF_LOW, 0x00);
      frame.onSidWrite(CUTOFF_HIGH, 0xff); // combined = 2040

      frame.setRegisterScale('cutoff', 2); // 4080, wrapping would give 1008
      const snapshot = frame.takeSnapshot();

      expect(transmittedByteForRegister(snapshot, CUTOFF_HIGH)).toBe(0xff);
      expect(transmittedByteForRegister(snapshot, CUTOFF_LOW)).toBe(0x07);
    });

    it('keeps re-emitting both cutoff registers while off home, on a tune that wrote them once', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(CUTOFF_LOW, 0x07);
      frame.onSidWrite(CUTOFF_HIGH, 0x64); // combined = 807, halved = 404
      frame.setRegisterScale('cutoff', 0.5);
      frame.takeSnapshot();

      for (const snapshot of [frame.takeSnapshot(), frame.takeSnapshot()]) {
        expect(transmittedByteForRegister(snapshot, CUTOFF_HIGH)).toBe(50);
        expect(transmittedByteForRegister(snapshot, CUTOFF_LOW)).toBe(4);
      }
    });

    it('restores the raw cutoff bytes for exactly one frame on the return home', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(CUTOFF_LOW, 0xff);
      frame.onSidWrite(CUTOFF_HIGH, 0x65);
      frame.setRegisterScale('cutoff', 0.5);
      frame.takeSnapshot();

      frame.setRegisterScale('cutoff', 1);
      const restore = frame.takeSnapshot();
      expect(transmittedByteForRegister(restore, CUTOFF_LOW)).toBe(0xff);
      expect(transmittedByteForRegister(restore, CUTOFF_HIGH)).toBe(0x65);

      const next = frame.takeSnapshot();
      expect(transmittedByteForRegister(next, CUTOFF_LOW)).toBeUndefined();
      expect(transmittedByteForRegister(next, CUTOFF_HIGH)).toBeUndefined();
    });

    it('emits nothing when a coefficient is set to the value it already holds', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(CUTOFF_LOW, 0x05);
      frame.takeSnapshot();

      frame.setRegisterScale('cutoff', 1); // already home — must not arm the one-shot restore

      expect(frame.takeSnapshot().values).toEqual([]);
    });

    it('scales register 23s resonance nibble without disturbing its filter-routing nibble', () => {
      for (let routing = 0; routing <= 0x0f; routing++) {
        const frame = new RegisterFrame();
        frame.onSidWrite(RESONANCE, 0xc0 | routing); // resonance 12
        frame.setRegisterScale('resonance', 0.5);

        expect(transmittedByteForRegister(frame.takeSnapshot(), RESONANCE)).toBe(0x60 | routing);
      }
    });

    it.each([
      ['lowPass', 0b001],
      ['bandPass', 0b010],
      ['highPass', 0b100],
      ['off', 0b000],
    ] as const)('replaces the volume registers mode bits with the forced %s mode alone', (mode, bits) => {
      const frame = new RegisterFrame();
      frame.onSidWrite(VOLUME, 0xba); // voice-3 mute set, tune's mode 0b011, volume 10

      frame.setFilterMode(mode);

      expect(transmittedByteForRegister(frame.takeSnapshot(), VOLUME)).toBe(
        0x80 | (bits << 4) | 0x0a
      );
    });

    it('composes gain and filter mode into one $D418 byte, neither clobbering the other', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(RESONANCE, 0xc9); // self-emits ahead of the volume slot in the packed values
      frame.onSidWrite(VOLUME, 0xba);

      frame.setRegisterScale('resonance', 0.5);
      frame.setOutputGain(0.5);
      const snapshot = frame.takeSnapshot();

      expect(transmittedByteForRegister(snapshot, VOLUME)).toBe(0x80 | 0x30 | 0x05);
      expect(transmittedByteForRegister(snapshot, RESONANCE)).toBe(0x69);
    });

    it('holds the volume slot present while a mode is forced and restores the raw byte once on release', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(VOLUME, 0xba);
      frame.setFilterMode('lowPass');
      frame.takeSnapshot();

      const held = frame.takeSnapshot();
      expect(transmittedByteForRegister(held, VOLUME)).toBe(0x80 | 0x10 | 0x0a);

      frame.setFilterMode(null);
      expect(transmittedByteForRegister(frame.takeSnapshot(), VOLUME)).toBe(0xba);
      expect(transmittedByteForRegister(frame.takeSnapshot(), VOLUME)).toBeUndefined();
    });

    it('emits nothing when the filter mode is set to the one already held', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(VOLUME, 0x2f);
      frame.takeSnapshot();

      frame.setFilterMode(null); // already released

      expect(frame.takeSnapshot().values).toEqual([]);
    });

    it('applies one pulse-width coefficient identically to all three voices, sparing the unused nibble', () => {
      const frame = new RegisterFrame();
      const raw = [
        [0x34, 0xf5],
        [0xcd, 0x3a],
        [0xff, 0x0f],
      ];
      const expected = [
        [0x9a, 0xf2], // 1332 -> 666
        [0x67, 0x35], // 2765 -> 1383
        [0x00, 0x08], // 4095 -> 2048
      ];
      PULSE_WIDTH_REGISTERS.forEach(([low, high], voice) => {
        frame.onSidWrite(low, raw[voice][0]);
        frame.onSidWrite(high, raw[voice][1]);
      });

      frame.setRegisterScale('pulseWidth', 0.5);
      const snapshot = frame.takeSnapshot();

      PULSE_WIDTH_REGISTERS.forEach(([low, high], voice) => {
        expect(transmittedByteForRegister(snapshot, low)).toBe(expected[voice][0]);
        expect(transmittedByteForRegister(snapshot, high)).toBe(expected[voice][1]);
      });
    });

    it('saturates pulse width at its 12-bit ceiling rather than wrapping', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(2, 0xff);
      frame.onSidWrite(3, 0xf8); // combined = 2303, upper nibble of the high register set

      frame.setRegisterScale('pulseWidth', 2); // 4606, wrapping would give 510
      const snapshot = frame.takeSnapshot();

      expect(transmittedByteForRegister(snapshot, 2)).toBe(0xff);
      expect(transmittedByteForRegister(snapshot, 3)).toBe(0xff);
    });

    it('applies one frequency coefficient identically to all three voices', () => {
      const frame = new RegisterFrame();
      const raw = [
        [0x34, 0x12],
        [0xcd, 0xab],
        [0x01, 0x00],
      ];
      const expected = [
        [0x1a, 0x09], // 0x1234 -> 0x091a
        [0xe7, 0x55], // 0xabcd -> 0x55e7
        [0x01, 0x00], // 1 -> 0.5, rounds back up to 1
      ];
      FREQUENCY_REGISTERS.forEach(([low, high], voice) => {
        frame.onSidWrite(low, raw[voice][0]);
        frame.onSidWrite(high, raw[voice][1]);
      });

      frame.setRegisterScale('frequency', 0.5);
      const snapshot = frame.takeSnapshot();

      FREQUENCY_REGISTERS.forEach(([low, high], voice) => {
        expect(transmittedByteForRegister(snapshot, low)).toBe(expected[voice][0]);
        expect(transmittedByteForRegister(snapshot, high)).toBe(expected[voice][1]);
      });
    });

    it('saturates frequency at its 16-bit ceiling rather than wrapping', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(0, 0x00);
      frame.onSidWrite(1, 0x80); // 0x8000

      frame.setRegisterScale('frequency', 3); // 98304, wrapping would give 32768
      const snapshot = frame.takeSnapshot();

      expect(transmittedByteForRegister(snapshot, 0)).toBe(0xff);
      expect(transmittedByteForRegister(snapshot, 1)).toBe(0xff);
    });

    it('forces all six frequency slots present every frame while off home, then restores them once', () => {
      const frame = new RegisterFrame();
      FREQUENCY_REGISTERS.forEach(([low, high]) => {
        frame.onSidWrite(low, 0x40);
        frame.onSidWrite(high, 0x20);
      });
      frame.setRegisterScale('frequency', 0.5);
      frame.takeSnapshot();

      const held = frame.takeSnapshot();
      for (const [low, high] of FREQUENCY_REGISTERS) {
        expect(transmittedByteForRegister(held, low)).toBe(0x20); // 0x2040 -> 0x1020
        expect(transmittedByteForRegister(held, high)).toBe(0x10);
      }

      frame.setRegisterScale('frequency', 1);
      const restore = frame.takeSnapshot();
      const settled = frame.takeSnapshot();
      for (const [low, high] of FREQUENCY_REGISTERS) {
        expect(transmittedByteForRegister(restore, low)).toBe(0x40);
        expect(transmittedByteForRegister(restore, high)).toBe(0x20);
        expect(transmittedByteForRegister(settled, low)).toBeUndefined();
        expect(transmittedByteForRegister(settled, high)).toBeUndefined();
      }
    });

    it('keeps snapshotValues() raw with every control off home', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(CUTOFF_LOW, 0xff);
      frame.onSidWrite(CUTOFF_HIGH, 0x65);
      frame.onSidWrite(RESONANCE, 0xc9);
      frame.onSidWrite(VOLUME, 0xba);
      frame.onSidWrite(2, 0x34);
      frame.onSidWrite(3, 0xf5);
      frame.onSidWrite(0, 0x34);
      frame.onSidWrite(1, 0x12);
      for (const group of ['volume', 'cutoff', 'resonance', 'pulseWidth', 'frequency'] as const) {
        frame.setRegisterScale(group, 0.5);
      }
      frame.setFilterMode('highPass');

      const { values } = frame.snapshotValues();

      for (const [register, raw] of [
        [CUTOFF_LOW, 0xff],
        [CUTOFF_HIGH, 0x65],
        [RESONANCE, 0xc9],
        [VOLUME, 0xba],
        [2, 0x34],
        [3, 0xf5],
        [0, 0x34],
        [1, 0x12],
      ]) {
        expect(values[PRIMARY_SLOT_FOR_REGISTER[register]]).toBe(raw);
      }
    });

    it('scales a restored cue once at the receiving frames coefficient, never twice', () => {
      const source = new RegisterFrame();
      source.onSidWrite(CUTOFF_LOW, 0xff);
      source.onSidWrite(CUTOFF_HIGH, 0x65); // combined = 815
      source.setRegisterScale('cutoff', 0.5);
      const cue = source.snapshotValues();

      const target = new RegisterFrame();
      target.restoreValues(cue);
      target.setRegisterScale('cutoff', 0.25);
      target.markAllDirty();
      const snapshot = target.takeSnapshot();

      // 815 * 0.25 = 203.75 -> 204. Double-scaled (815 * 0.5 * 0.25) would land on 102.
      expect(transmittedByteForRegister(snapshot, CUTOFF_HIGH)).toBe(204 >> 3);
      expect(transmittedByteForRegister(snapshot, CUTOFF_LOW)).toBe(0xf8 | (204 & 0x07));
    });

    it('keeps the all-dirty snapshot at one entry per slot with every active control applied', () => {
      const frame = new RegisterFrame();
      frame.onSidWrite(CUTOFF_LOW, 0xff);
      frame.onSidWrite(CUTOFF_HIGH, 0x65);
      frame.onSidWrite(RESONANCE, 0xc9);
      frame.onSidWrite(VOLUME, 0xba);
      frame.setRegisterScale('cutoff', 0.5);
      frame.setRegisterScale('resonance', 0.5);
      frame.setOutputGain(0.5);
      frame.setFilterMode('bandPass');

      frame.markAllDirty();
      const snapshot = frame.takeSnapshot();

      expect(snapshot.values).toHaveLength(25);
      expect(snapshot.presentMask).toEqual([0x7f, 0x7f, 0x7f, 0x0f]);
      expect(transmittedByteForRegister(snapshot, CUTOFF_LOW)).toBe(0xf8);
      expect(transmittedByteForRegister(snapshot, CUTOFF_HIGH)).toBe(0x33);
      expect(transmittedByteForRegister(snapshot, RESONANCE)).toBe(0x69);
      expect(transmittedByteForRegister(snapshot, VOLUME)).toBe(0x80 | 0x20 | 0x05);
    });
  });

  describe('the generalized scaling against a real register stream (InSID3 Out)', () => {
    interface TuneRun {
      readonly snapshots: FrameSnapshot[];
      readonly suppressedWrites: number;
    }

    /** Runs the bundled tune for `frames` play calls, calling `perFrame` before each one so a control
     *  can be swept exactly as a deck would move it. */
    function runTune(
      frames: number,
      perFrame?: (frame: RegisterFrame, index: number) => void
    ): TuneRun {
      const frame = new RegisterFrame();
      const machine = new C64Machine(insid3Out(), frame);
      machine.initSubtune(1);

      const snapshots: FrameSnapshot[] = [];
      for (let i = 0; i < frames; i++) {
        perFrame?.(frame, i);
        machine.runFrame();
        snapshots.push(frame.takeSnapshot());
      }
      return { snapshots, suppressedWrites: frame.suppressedWriteCount };
    }

    const FRAMES = 600;
    const FILTER_MODE_SWEEP: (SidFilterMode | null)[] = [
      null,
      'lowPass',
      'bandPass',
      'highPass',
      'off',
    ];

    let baseline: TuneRun;

    beforeAll(() => {
      baseline = runTune(FRAMES);
    }, 30_000);

    it('leaves the whole register stream bit-identical when every control is parked at home', () => {
      const home = runTune(FRAMES, (frame, index) => {
        if (index > 0) return;
        for (const group of ['volume', 'cutoff', 'resonance', 'pulseWidth', 'frequency'] as const) {
          frame.setRegisterScale(group, 1);
        }
        frame.setFilterMode(null);
      });

      expect(home.snapshots).toEqual(baseline.snapshots);
    });

    it("halves the tune's own cutoff in every frame, tracking its real writes", () => {
      const scaled = runTune(FRAMES, (frame, index) => {
        if (index === 0) frame.setRegisterScale('cutoff', 0.5);
      });

      let rawLow = 0;
      let rawHigh = 0;
      let framesTheTuneWroteCutoff = 0;
      let framesTheCoefficientMovedTheBytes = 0;

      for (let i = 0; i < FRAMES; i++) {
        const raw = transmittedBytesBySlot(baseline.snapshots[i]);
        const lowWrite = raw.get(PRIMARY_SLOT_FOR_REGISTER[21]);
        const highWrite = raw.get(PRIMARY_SLOT_FOR_REGISTER[22]);
        if (lowWrite !== undefined || highWrite !== undefined) framesTheTuneWroteCutoff++;
        rawLow = lowWrite ?? rawLow;
        rawHigh = highWrite ?? rawHigh;

        const expected = clamp(Math.round(((rawHigh << 3) | (rawLow & 0x07)) * 0.5), 0, 0x7ff);
        const emitted = transmittedBytesBySlot(scaled.snapshots[i]);
        const emittedLow = emitted.get(PRIMARY_SLOT_FOR_REGISTER[21]);
        const emittedHigh = emitted.get(PRIMARY_SLOT_FOR_REGISTER[22]);
        expect(emittedLow).toBe((rawLow & 0xf8) | (expected & 0x07));
        expect(emittedHigh).toBe((expected >> 3) & 0xff);
        if (emittedLow !== rawLow || emittedHigh !== rawHigh) framesTheCoefficientMovedTheBytes++;
      }

      // Guards the assertions above against passing vacuously on a cutoff the tune leaves at zero.
      expect(framesTheTuneWroteCutoff).toBeGreaterThan(0);
      expect(framesTheCoefficientMovedTheBytes).toBeGreaterThan(0);
    });

    it('leaves the suppressed-write count identical to the unscaled run across a full control sweep', () => {
      const swept = runTune(FRAMES, (frame, index) => {
        const t = index / (FRAMES - 1);
        frame.setOutputGain(t);
        frame.setRegisterScale('cutoff', 0.25 + t);
        frame.setRegisterScale('resonance', 1.5 - t);
        frame.setRegisterScale('pulseWidth', 0.5 + t);
        frame.setRegisterScale('frequency', 0.9 + t * 0.2);
        frame.setFilterMode(FILTER_MODE_SWEEP[index % FILTER_MODE_SWEEP.length]);
      });

      expect(swept.suppressedWrites).toBe(baseline.suppressedWrites);
    });
  });

  describe('the output gain scaling against a real fade (InSID3 Out)', () => {
    /** Plays `frames` play calls with `gain` applied throughout, recording every frame's transmitted
     *  $D418 byte (slot 21) by frame index, wherever the volume slot was present that frame. */
    function recordVolumeByFrame(frames: number, gain: number): Map<number, number> {
      const frame = new RegisterFrame();
      const machine = new C64Machine(insid3Out(), frame);
      machine.initSubtune(1);
      frame.setOutputGain(gain);

      const byFrame = new Map<number, number>();
      for (let i = 0; i < frames; i++) {
        machine.runFrame();
        const snapshot = frame.takeSnapshot();
        const transmitted = transmittedBytesBySlot(snapshot).get(21);
        if (transmitted !== undefined) {
          byFrame.set(i, transmitted);
        }
      }
      return byFrame;
    }

    /** Long enough to run past the tune's own $D418 fade-to-silence and its loop restart back to
     *  full — empirically frames ~15,460-16,170 of subtune 1, at roughly one level every 48 play
     *  calls, matching the handoff's own reference note. */
    const FRAMES = 20_000;

    let raw: Map<number, number>;
    let scaled: Map<number, number>;

    beforeAll(() => {
      raw = recordVolumeByFrame(FRAMES, 1);
      scaled = recordVolumeByFrame(FRAMES, 0.5);
    }, 30_000);

    it("fades the low nibble down to silence in step with the tune's own ramp, holding the filter-mode nibble fixed", () => {
      const entries = [...raw.entries()].sort(([a], [b]) => a - b);

      // The first handful of frames carry the init routine's own bootstrap value ($D418=$0F, mode
      // 0), immediately superseded once the play routine starts writing its own mode nibble — the
      // dominant high nibble across the recording is that mode, not the bootstrap one.
      const highNibbleCounts = new Map<number, number>();
      for (const [, byte] of entries) {
        const high = byte & 0xf0;
        highNibbleCounts.set(high, (highNibbleCounts.get(high) ?? 0) + 1);
      }
      const [dominantHighNibble, dominantCount] = [...highNibbleCounts.entries()].sort(
        (a, b) => b[1] - a[1]
      )[0];
      expect(dominantCount / entries.length).toBeGreaterThan(0.99);

      const playing = entries.filter(([, byte]) => (byte & 0xf0) === dominantHighNibble);
      const lowNibbles: number[] = [];
      for (const [, byte] of playing) {
        const value = byte & 0x0f;
        if (lowNibbles[lowNibbles.length - 1] !== value) lowNibbles.push(value);
      }
      expect(lowNibbles).toContain(15);
      expect(lowNibbles).toContain(0);

      let longestDescent = 1;
      let current = 1;
      for (let i = 1; i < lowNibbles.length; i++) {
        current = lowNibbles[i] < lowNibbles[i - 1] ? current + 1 : 1;
        longestDescent = Math.max(longestDescent, current);
      }
      // A real fade steps down through most of the sixteen levels; a stray one-off dip elsewhere in
      // the stream could never produce a run this long.
      expect(longestDescent).toBeGreaterThanOrEqual(8);
    });

    it('scales every write of the real fade by a fixed gain, proportionally, without disturbing the mode nibble', () => {
      expect(raw.size).toBeGreaterThan(1);
      for (const [i, rawByte] of raw) {
        const scaledByte = scaled.get(i);
        expect(scaledByte).toBeDefined();
        expect((scaledByte as number) & 0xf0).toBe(rawByte & 0xf0);
        expect((scaledByte as number) & 0x0f).toBe(
          clamp(Math.round((rawByte & 0x0f) * 0.5), 0, 15)
        );
      }
    });
  });
});

function popcount(byte: number): number {
  let count = 0;
  let remaining = byte;
  while (remaining) {
    count += remaining & 1;
    remaining >>= 1;
  }
  return count;
}

function insid3Out(): SidFile {
  const entry = BUNDLED_TUNES.find((candidate) => candidate.id === 'insid3-out');
  if (!entry) {
    throw new Error('bundled tune "insid3-out" not found');
  }
  return parseSidFile(decodeBundledTune(entry.base64));
}

/** Reconstructs the full transmitted byte per present slot from a packed snapshot. */
function transmittedBytesBySlot(snapshot: FrameSnapshot): Map<number, number> {
  const bytesBySlot = new Map<number, number>();
  let index = 0;
  for (let slot = 0; slot < ASID_SLOT_COUNT; slot++) {
    const byteIndex = (slot / 7) | 0;
    const bit = 1 << slot % 7;
    if (!(snapshot.presentMask[byteIndex] & bit)) continue;
    const msb = snapshot.msbMask[byteIndex] & bit ? 0x80 : 0;
    bytesBySlot.set(slot, snapshot.values[index] | msb);
    index++;
  }
  return bytesBySlot;
}

/** register 24 -> primary slot 21 -> byte index 3, bit 0 (see the register-slot map at the top of
 *  this file). Only safe where slot 21 is the packet's sole present slot, so that `values[0]` names
 *  it — the moment another group self-emits, slots 18-20 pack ahead of it. Anything scaling more
 *  than gain must go through `transmittedByteForRegister`. */
function volumeByteFromSnapshot(snapshot: FrameSnapshot): number {
  return snapshot.values[0] | (snapshot.msbMask[3] & 0b1 ? 0x80 : 0);
}

/** The byte a register's primary slot transmitted this frame, or undefined if it was not present. */
function transmittedByteForRegister(
  snapshot: FrameSnapshot,
  register: number
): number | undefined {
  return transmittedBytesBySlot(snapshot).get(PRIMARY_SLOT_FOR_REGISTER[register]);
}
