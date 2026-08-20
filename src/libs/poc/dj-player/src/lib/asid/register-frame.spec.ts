import { describe, it, expect } from 'vitest';
import { RegisterFrame } from './register-frame';

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
