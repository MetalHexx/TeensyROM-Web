import type { SidWriteSink } from '../cpu/c64-machine';
import {
  ASID_SLOT_COUNT,
  ASID_SLOT_TO_REGISTER,
  REGISTERS_PER_VOICE,
  SID_FILTER_CUTOFF_HIGH_REGISTER,
  SID_FILTER_CUTOFF_LOW_REGISTER,
  SID_FILTER_MODE_BAND_PASS,
  SID_FILTER_MODE_HIGH_PASS,
  SID_FILTER_MODE_LOW_PASS,
  SID_FILTER_MODE_MASK,
  SID_FILTER_MODE_OFF,
  SID_FILTER_MODE_SHIFT,
  SID_FILTER_RESONANCE_REGISTER,
  SID_REGISTER_COUNT,
  SID_VOLUME_REGISTER,
  VOICE_CONTROL_REGISTERS,
  VOICE_COUNT,
} from './asid-constants';
import { clamp } from '../engine/engine-utils';

/** The present/MSB mask bytes and present-slot values a SID data packet is built from. */
export interface FrameSnapshot {
  readonly presentMask: number[];
  readonly msbMask: number[];
  readonly values: number[];
}

/**
 * The accumulated slot values alone, detached from any per-frame dirty state.
 *
 * Deliberately not a `FrameSnapshot`: that type is a packet under construction, this one is chip
 * state — where every register stood at a moment, regardless of which of them were about to be sent.
 */
export interface RegisterValuesSnapshot {
  readonly values: Uint8Array;
}

/**
 * `ASID_SLOT_TO_REGISTER` inverted over its first 25 (non-duplicate) entries: register -> its
 * primary slot. Exported as the single decode point for this mapping — every slot-indexed reader
 * (this class and the analysis scan's frame-feature decoder alike) crosses this same table rather
 * than re-deriving it.
 */
export const PRIMARY_SLOT_FOR_REGISTER = buildPrimarySlotTable();
const SECONDARY_SLOT_FOR_REGISTER = buildSecondarySlotTable();
const VOICE_INDEX_FOR_REGISTER = buildVoiceIndexTable();

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

/** `VOICE_CONTROL_REGISTERS` inverted: register -> its voice index, for the per-write hot path. */
function buildVoiceIndexTable(): ReadonlyMap<number, number> {
  const table = new Map<number, number>();
  VOICE_CONTROL_REGISTERS.forEach((register, voice) => table.set(register, voice));
  return table;
}

/**
 * The register groups a deck's controls scale at the packet boundary. `volume` is the deck-gain path
 * this mechanism was generalized from.
 */
export type ScaledRegisterGroup = 'volume' | 'cutoff' | 'resonance' | 'pulseWidth' | 'frequency';

/** Bits 4-6 of `$D418`. `null` is not a mode — it means the tune's own bits pass through. */
export type SidFilterMode = 'lowPass' | 'bandPass' | 'highPass' | 'off';

const SCALED_REGISTER_GROUPS: readonly ScaledRegisterGroup[] = [
  'volume',
  'cutoff',
  'resonance',
  'pulseWidth',
  'frequency',
];

const FILTER_MODE_BITS: Readonly<Record<SidFilterMode, number>> = {
  lowPass: SID_FILTER_MODE_LOW_PASS,
  bandPass: SID_FILTER_MODE_BAND_PASS,
  highPass: SID_FILTER_MODE_HIGH_PASS,
  off: SID_FILTER_MODE_OFF,
};

// Register offsets from a voice's base register, mirroring the analysis decoder's own layout.
const VOICE_FREQUENCY_LOW_OFFSET = 0;
const VOICE_FREQUENCY_HIGH_OFFSET = 1;
const VOICE_PULSE_WIDTH_LOW_OFFSET = 2;
const VOICE_PULSE_WIDTH_HIGH_OFFSET = 3;

const VOLUME_SLOT = PRIMARY_SLOT_FOR_REGISTER[SID_VOLUME_REGISTER];
const CUTOFF_LOW_SLOT = PRIMARY_SLOT_FOR_REGISTER[SID_FILTER_CUTOFF_LOW_REGISTER];
const CUTOFF_HIGH_SLOT = PRIMARY_SLOT_FOR_REGISTER[SID_FILTER_CUTOFF_HIGH_REGISTER];
const RESONANCE_SLOT = PRIMARY_SLOT_FOR_REGISTER[SID_FILTER_RESONANCE_REGISTER];

const NIBBLE_CEILING = 0x0f;
const CUTOFF_CEILING = 0x07ff;
const PULSE_WIDTH_CEILING = 0x0fff;
const FREQUENCY_CEILING = 0xffff;

/** Every slot a group owns, so a group off its home coefficient can force all of them present. */
const SLOTS_FOR_GROUP: Readonly<Record<ScaledRegisterGroup, readonly number[]>> = {
  volume: [VOLUME_SLOT],
  cutoff: [CUTOFF_LOW_SLOT, CUTOFF_HIGH_SLOT],
  resonance: [RESONANCE_SLOT],
  pulseWidth: voiceSlots(VOICE_PULSE_WIDTH_LOW_OFFSET, VOICE_PULSE_WIDTH_HIGH_OFFSET),
  frequency: voiceSlots(VOICE_FREQUENCY_LOW_OFFSET, VOICE_FREQUENCY_HIGH_OFFSET),
};

function voiceSlots(lowOffset: number, highOffset: number): readonly number[] {
  const slots: number[] = [];
  for (let voice = 0; voice < VOICE_COUNT; voice++) {
    const base = voice * REGISTERS_PER_VOICE;
    slots.push(
      PRIMARY_SLOT_FOR_REGISTER[base + lowOffset],
      PRIMARY_SLOT_FOR_REGISTER[base + highOffset]
    );
  }
  return slots;
}

/**
 * One multiplication and exactly one rounding, applied to a field at its true width and clamped to
 * its ceiling — scaling a multi-register field a byte at a time would round twice and could split
 * back inconsistently across the pair.
 */
function scaleField(value: number, coefficient: number, ceiling: number): number {
  return clamp(Math.round(value * coefficient), 0, ceiling);
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

  /** Home is exactly 1 for every group: the tune's own bytes pass through bit-for-bit. */
  private readonly coefficients: Record<ScaledRegisterGroup, number> = {
    volume: 1,
    cutoff: 1,
    resonance: 1,
    pulseWidth: 1,
    frequency: 1,
  };
  /** One-shot per group: the standing off-home check stops covering a group's slots the instant its
   *  coefficient returns to exactly 1, so this is what forces one more presence on that transition —
   *  the restoring write the standing condition can no longer produce. Without it the last scaled
   *  value stands on the chip forever on a tune that never rewrites those registers. */
  private readonly restoreOnNextSnapshot: Record<ScaledRegisterGroup, boolean> = {
    volume: false,
    cutoff: false,
    resonance: false,
    pulseWidth: false,
    frequency: false,
  };

  private forcedFilterMode: SidFilterMode | null = null;
  private restoreFilterModeOnNextSnapshot = false;

  /** Per-frame scratch, cleared and refilled in `takeSnapshot()` — scaling runs inside frame
   *  delivery, so nothing on this path may allocate. */
  private readonly overrideValues = new Uint8Array(ASID_SLOT_COUNT);
  private readonly overridePresent = new Uint8Array(ASID_SLOT_COUNT);

  /** Voice 0/1/2. Muting forces that voice's control register to 0 once, then drops every further
   * write the tune's code makes to it until unmuted — every other register for that voice keeps
   * updating live throughout, exactly matching `IOH_ASID.c`'s hardware-mute technique. */
  setVoiceMuted(voice: number, muted: boolean): void {
    if (voice < 0 || voice >= VOICE_CONTROL_REGISTERS.length) return;
    if (muted === this.mutedVoices.has(voice)) return;
    if (muted) {
      this.mutedVoices.add(voice);
      this.setSlot(PRIMARY_SLOT_FOR_REGISTER[VOICE_CONTROL_REGISTERS[voice]], 0);
    } else {
      this.mutedVoices.delete(voice);
    }
  }

  /**
   * Multiplies a register group by `coefficient`, full resolution, applied in `takeSnapshot()` and
   * never at the write — scaling at the packet boundary rather than in `onSidWrite` is what keeps
   * `snapshotValues()`/`restoreValues()` raw (so a cue re-entered at a different knob position never
   * double-applies a coefficient), keeps quantization to a single rounding per field, and keeps this
   * stage out of `suppressedWrites` entirely, since none of these registers routes through a scaling
   * branch in the write path.
   *
   * A coefficient of exactly 1 is home, not a multiplication by one: the group's raw bytes pass
   * through untouched. `pulseWidth` and `frequency` hold one coefficient shared by all three voices,
   * so scaling them preserves the tune's internal balance between its voices.
   *
   * A no-op call (the coefficient already held) leaves the one-shot restore untouched, so repeatedly
   * setting the same value can never manufacture a spurious extra write.
   */
  setRegisterScale(group: ScaledRegisterGroup, coefficient: number): void {
    if (coefficient === this.coefficients[group]) return;
    if (this.coefficients[group] !== 1 && coefficient === 1) {
      this.restoreOnNextSnapshot[group] = true;
    }
    this.coefficients[group] = coefficient;
  }

  /**
   * Replaces `$D418`'s filter-mode bits in every emitted volume byte until deselected. This is an
   * override rather than a scale — the tune's own mode bits are discarded while one is held, and
   * `null` hands them back. Selecting forces the volume slot present the same way an off-home
   * coefficient does; deselecting arms the same one-shot restore.
   */
  setFilterMode(mode: SidFilterMode | null): void {
    if (mode === this.forcedFilterMode) return;
    if (this.forcedFilterMode !== null && mode === null) {
      this.restoreFilterModeOnNextSnapshot = true;
    }
    this.forcedFilterMode = mode;
  }

  /** 0…1, full resolution — the deck-gain entry point onto `$D418`'s low nibble, and one group of
   *  the same scaling stage as every other control. */
  setOutputGain(gain: number): void {
    this.setRegisterScale('volume', gain);
  }

  onSidWrite(register: number, value: number): void {
    const voiceIndex = VOICE_INDEX_FOR_REGISTER.get(register);
    if (voiceIndex !== undefined && this.mutedVoices.has(voiceIndex)) {
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
   *
   * The one exception to "packs what's present": a control that is off home forces its whole group's
   * slots present. That is a standing condition re-checked live on every call, so a snapshot a caller
   * discards — `auditionMarkerEnd`'s reset pass, chiefly — can never swallow a knob move on a tune
   * that does not keep rewriting those registers itself. Scaled bytes are computed once per frame,
   * before the pack loop, because a two-register group read per slot would combine and round twice.
   */
  takeSnapshot(): FrameSnapshot {
    this.forceScaledGroupsPresent();
    this.buildScaledOverrides();

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

      const value = this.overridePresent[slot] ? this.overrideValues[slot] : this.values[slot];
      if (value & 0x80) {
        msbMask[byteIndex] |= bit;
      }
      values.push(value & 0x7f);
    }

    this.present.fill(0);
    this.writtenThisFrame.fill(0);

    return { presentMask, msbMask, values };
  }

  /** Self-emission: every slot of every off-home group, plus the volume slot while a filter mode is
   *  held, and one further frame for whichever of them has just come home. */
  private forceScaledGroupsPresent(): void {
    for (let index = 0; index < SCALED_REGISTER_GROUPS.length; index++) {
      const group = SCALED_REGISTER_GROUPS[index];
      if (this.coefficients[group] !== 1 || this.restoreOnNextSnapshot[group]) {
        this.markGroupPresent(group);
      }
      this.restoreOnNextSnapshot[group] = false;
    }

    if (this.forcedFilterMode !== null || this.restoreFilterModeOnNextSnapshot) {
      this.markGroupPresent('volume');
    }
    this.restoreFilterModeOnNextSnapshot = false;
  }

  private markGroupPresent(group: ScaledRegisterGroup): void {
    const slots = SLOTS_FOR_GROUP[group];
    for (let index = 0; index < slots.length; index++) {
      this.present[slots[index]] = 1;
    }
  }

  /** Rebuilds this frame's overridden bytes into the scratch buffers. A group at home writes none,
   *  leaving its raw bytes to pack through untouched. */
  private buildScaledOverrides(): void {
    this.overridePresent.fill(0);
    this.overrideValues.fill(0);

    this.composeVolumeByte();
    this.scaleCutoff(this.coefficients.cutoff);
    this.scaleResonance(this.coefficients.resonance);
    for (let voice = 0; voice < VOICE_COUNT; voice++) {
      this.scaleVoicePulseWidth(voice, this.coefficients.pulseWidth);
      this.scaleVoiceFrequency(voice, this.coefficients.frequency);
    }
  }

  /** `$D418` composes two controls at once: gain owns the low nibble, the forced filter mode owns
   *  bits 4-6, and bit 7 (voice-3 mute) belongs to neither and always passes through raw. */
  private composeVolumeByte(): void {
    const gain = this.coefficients.volume;
    if (gain === 1 && this.forcedFilterMode === null) return;

    const raw = this.values[VOLUME_SLOT];
    const volume = gain === 1 ? raw & 0x0f : scaleField(raw & 0x0f, gain, NIBBLE_CEILING);
    const mode =
      this.forcedFilterMode === null
        ? (raw >> SID_FILTER_MODE_SHIFT) & SID_FILTER_MODE_MASK
        : FILTER_MODE_BITS[this.forcedFilterMode];

    this.setOverride(VOLUME_SLOT, (raw & 0x80) | (mode << SID_FILTER_MODE_SHIFT) | volume);
  }

  /** 11 bits across registers 21 and 22, register 21's upper five bits belonging to nothing here. */
  private scaleCutoff(coefficient: number): void {
    if (coefficient === 1) return;

    const rawLow = this.values[CUTOFF_LOW_SLOT];
    const rawHigh = this.values[CUTOFF_HIGH_SLOT];
    const scaled = scaleField((rawHigh << 3) | (rawLow & 0x07), coefficient, CUTOFF_CEILING);

    this.setOverride(CUTOFF_LOW_SLOT, (rawLow & 0xf8) | (scaled & 0x07));
    this.setOverride(CUTOFF_HIGH_SLOT, (scaled >> 3) & 0xff);
  }

  /** Register 23's high nibble only — the low nibble routes voices through the filter and is the
   *  tune's alone. */
  private scaleResonance(coefficient: number): void {
    if (coefficient === 1) return;

    const raw = this.values[RESONANCE_SLOT];
    const scaled = scaleField((raw >> 4) & 0x0f, coefficient, NIBBLE_CEILING);

    this.setOverride(RESONANCE_SLOT, (raw & 0x0f) | (scaled << 4));
  }

  /** 12 bits across the voice's register pair, the high register's upper nibble unused. */
  private scaleVoicePulseWidth(voice: number, coefficient: number): void {
    if (coefficient === 1) return;

    const base = voice * REGISTERS_PER_VOICE;
    const lowSlot = PRIMARY_SLOT_FOR_REGISTER[base + VOICE_PULSE_WIDTH_LOW_OFFSET];
    const highSlot = PRIMARY_SLOT_FOR_REGISTER[base + VOICE_PULSE_WIDTH_HIGH_OFFSET];
    const rawLow = this.values[lowSlot];
    const rawHigh = this.values[highSlot];
    const scaled = scaleField(((rawHigh & 0x0f) << 8) | rawLow, coefficient, PULSE_WIDTH_CEILING);

    this.setOverride(lowSlot, scaled & 0xff);
    this.setOverride(highSlot, (rawHigh & 0xf0) | ((scaled >> 8) & 0x0f));
  }

  /** A full 16 bits across the voice's register pair — no shared fields to preserve. */
  private scaleVoiceFrequency(voice: number, coefficient: number): void {
    if (coefficient === 1) return;

    const base = voice * REGISTERS_PER_VOICE;
    const lowSlot = PRIMARY_SLOT_FOR_REGISTER[base + VOICE_FREQUENCY_LOW_OFFSET];
    const highSlot = PRIMARY_SLOT_FOR_REGISTER[base + VOICE_FREQUENCY_HIGH_OFFSET];
    const scaled = scaleField(
      (this.values[highSlot] << 8) | this.values[lowSlot],
      coefficient,
      FREQUENCY_CEILING
    );

    this.setOverride(lowSlot, scaled & 0xff);
    this.setOverride(highSlot, (scaled >> 8) & 0xff);
  }

  private setOverride(slot: number, value: number): void {
    this.overrideValues[slot] = value;
    this.overridePresent[slot] = 1;
  }

  /**
   * Copies the accumulated slot values, leaving this frame untouched.
   *
   * Per-frame dirty tracking is excluded on purpose — a cue records where the chip stood, not which
   * registers happened to be mid-flight when it was captured.
   */
  snapshotValues(): RegisterValuesSnapshot {
    return { values: this.values.slice() };
  }

  /**
   * Replaces the accumulated slot values wholesale and drops any half-built frame.
   *
   * Mute is not part of the snapshot: whichever voices are muted *now* stay muted, so returning to a
   * cue captured before a mute does not un-mute it on the way back in. Only the primary slots are
   * re-zeroed — `markAllDirty` covers slots 0-24, so the secondary gate slots never reach a resync.
   */
  restoreValues(snapshot: RegisterValuesSnapshot): void {
    this.values.set(snapshot.values);
    this.present.fill(0);
    this.writtenThisFrame.fill(0);
    for (const voice of this.mutedVoices) {
      this.values[PRIMARY_SLOT_FOR_REGISTER[VOICE_CONTROL_REGISTERS[voice]]] = 0;
    }
  }

  private setSlot(slot: number, value: number): void {
    this.present[slot] = 1;
    this.values[slot] = value;
  }
}
