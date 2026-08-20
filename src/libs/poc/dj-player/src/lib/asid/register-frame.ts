import type { SidWriteSink } from '../cpu/c64-machine';
import {
  ASID_SLOT_COUNT,
  ASID_SLOT_TO_REGISTER,
  SID_REGISTER_COUNT,
  VOICE_CONTROL_REGISTERS,
} from './asid-constants';

/** The present/MSB mask bytes and present-slot values a SID data packet is built from. */
export interface FrameSnapshot {
  readonly presentMask: number[];
  readonly msbMask: number[];
  readonly values: number[];
}

const PRIMARY_SLOT_FOR_REGISTER = buildPrimarySlotTable();
const SECONDARY_SLOT_FOR_REGISTER = buildSecondarySlotTable();

/** `ASID_SLOT_TO_REGISTER` inverted over its first 25 (non-duplicate) entries. */
function buildPrimarySlotTable(): readonly number[] {
  const table = new Array<number>(SID_REGISTER_COUNT).fill(-1);
  for (let slot = 0; slot < SID_REGISTER_COUNT; slot++) {
    table[ASID_SLOT_TO_REGISTER[slot]] = slot;
  }
  return table;
}

/** Registers 4, 11 and 18 -> their secondary slots 25, 26 and 27. */
function buildSecondarySlotTable(): ReadonlyMap<number, number> {
  const table = new Map<number, number>();
  for (let slot = SID_REGISTER_COUNT; slot < ASID_SLOT_TO_REGISTER.length; slot++) {
    table.set(ASID_SLOT_TO_REGISTER[slot], slot);
  }
  return table;
}

/**
 * Accumulates one frame's SID writes into the 28 ASID slots and turns them into a `FrameSnapshot`
 * ready for `buildSidDataPacket`.
 *
 * A second write in the same frame to register 4, 11 or 18 (the voice gate registers) lands in
 * that register's secondary slot alongside the first. A second write to any other register
 * overwrites the first and is counted as suppressed. Either way the frame is never flushed early —
 * with the cartridge's frame timer engaged, every packet it receives is a frame to its queue.
 */
export class RegisterFrame implements SidWriteSink {
  private readonly present = new Uint8Array(ASID_SLOT_COUNT);
  private readonly values = new Uint8Array(ASID_SLOT_COUNT);
  private readonly writtenThisFrame = new Uint8Array(SID_REGISTER_COUNT);
  private suppressedWrites = 0;
  private readonly mutedVoices = new Set<number>(); // voice index 0..2

  /** Voice 0/1/2. Muting forces that voice's control register to 0 once, then drops every further
   * write the tune's code makes to it until unmuted — every other register for that voice keeps
   * updating live throughout, exactly matching `IOH_ASID.c`'s hardware-mute technique. */
  setVoiceMuted(voice: number, muted: boolean): void {
    if (muted === this.mutedVoices.has(voice)) return;
    if (muted) {
      this.mutedVoices.add(voice);
      this.setSlot(PRIMARY_SLOT_FOR_REGISTER[VOICE_CONTROL_REGISTERS[voice]], 0);
    } else {
      this.mutedVoices.delete(voice);
    }
  }

  onSidWrite(register: number, value: number): void {
    const voiceIndex = VOICE_CONTROL_REGISTERS.indexOf(register);
    if (voiceIndex !== -1 && this.mutedVoices.has(voiceIndex)) {
      return; // muted — matches the firmware's discard-register redirect
    }

    const primarySlot = PRIMARY_SLOT_FOR_REGISTER[register];

    if (!this.writtenThisFrame[register]) {
      this.writtenThisFrame[register] = 1;
      this.setSlot(primarySlot, value);
      return;
    }

    const secondarySlot = SECONDARY_SLOT_FOR_REGISTER.get(register);
    if (secondarySlot !== undefined) {
      this.setSlot(secondarySlot, value);
      return;
    }

    this.setSlot(primarySlot, value);
    this.suppressedWrites++;
  }

  /**
   * Forces every one of the 25 registers into the next snapshot at its current value (0 if never
   * written) — called once after init so the chip starts a session from a known state instead of
   * carrying over silence.
   */
  markAllDirty(): void {
    for (let slot = 0; slot < SID_REGISTER_COUNT; slot++) {
      this.present[slot] = 1;
    }
  }

  /**
   * Second writes folded into their register's primary slot instead of a secondary one, counted
   * across this object's lifetime rather than per frame — the data point for how often it matters
   * in practice.
   */
  get suppressedWriteCount(): number {
    return this.suppressedWrites;
  }

  /**
   * Packs the present slots into the SID data packet's mask/value shape, then clears dirty state —
   * including the per-frame second-write tracking — so the next frame starts empty.
   */
  takeSnapshot(): FrameSnapshot {
    const presentMask = [0, 0, 0, 0];
    const msbMask = [0, 0, 0, 0];
    const values: number[] = [];

    for (let slot = 0; slot < ASID_SLOT_COUNT; slot++) {
      if (!this.present[slot]) {
        continue;
      }

      const byteIndex = (slot / 7) | 0;
      const bit = 1 << slot % 7;
      presentMask[byteIndex] |= bit;

      const value = this.values[slot];
      if (value & 0x80) {
        msbMask[byteIndex] |= bit;
      }
      values.push(value & 0x7f);
    }

    this.present.fill(0);
    this.writtenThisFrame.fill(0);

    return { presentMask, msbMask, values };
  }

  private setSlot(slot: number, value: number): void {
    this.present[slot] = 1;
    this.values[slot] = value;
  }
}
