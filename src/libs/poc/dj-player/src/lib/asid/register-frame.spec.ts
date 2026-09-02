import { describe, it, expect, beforeAll } from 'vitest';
import { RegisterFrame } from './register-frame';
import type { FrameSnapshot } from './register-frame';
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
    /** register 24 -> primary slot 21 -> byte index 3, bit 0 (see the register-slot map at the top of
     *  this file). Every test below writes only register 24, so slot 21 is the packet's sole present
     *  slot and `values[0]`/`msbMask[3]` name it directly. */
    function volumeByteFromSnapshot(snapshot: FrameSnapshot): number {
      return snapshot.values[0] | (snapshot.msbMask[3] & 0b1 ? 0x80 : 0);
    }

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

  describe('the output gain scaling against a real fade (InSID3 Out)', () => {
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
