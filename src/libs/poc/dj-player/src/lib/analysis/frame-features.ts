import { ASID_SLOT_COUNT, ASID_SLOT_TO_REGISTER, SID_REGISTER_COUNT } from '../asid/asid-constants';
import type { ScanOutput } from './scan-tune';

/** register -> ASID slot, built once. `RegisterValuesSnapshot.values` is slot-indexed, not
 *  register-indexed, so every read has to cross this table first — reading `values[register]`
 *  directly is the bug this table exists to prevent. */
const REGISTER_TO_SLOT = buildRegisterToSlot();

function buildRegisterToSlot(): number[] {
  const table = new Array<number>(SID_REGISTER_COUNT);
  for (let slot = 0; slot < SID_REGISTER_COUNT; slot++) {
    table[ASID_SLOT_TO_REGISTER[slot]] = slot;
  }
  return table;
}

export interface VoiceFeatures {
  readonly frequency: number; // 0..65535, from the register pair
  readonly pulseWidth: number; // 0..4095
  readonly waveform: number; // control bits 4..7: triangle/saw/pulse/noise
  readonly gate: boolean; // control bit 0
  readonly attackDecay: number; // raw register
  readonly sustainRelease: number; // raw register
}

export interface FrameFeatures {
  readonly voices: readonly VoiceFeatures[]; // always length 3
  readonly cutoff: number; // 0..2047, 11-bit
  readonly resonance: number; // 0..15
  readonly filterRouting: number; // bits 0..3 of the resonance/routing register
  readonly volume: number; // 0..15
  readonly writeCount: number;
}

const VOICE_COUNT = 3;
const REGISTERS_PER_VOICE = 7;
const FILTER_CUTOFF_LOW = 21;
const FILTER_CUTOFF_HIGH = 22;
const FILTER_RESONANCE_ROUTING = 23;
const FILTER_VOLUME = 24;

/** Reads one frame's slot row out of a scan and decodes it into named SID features. */
export function readFrameFeatures(scan: ScanOutput, frame: number): FrameFeatures {
  const voices: VoiceFeatures[] = [];
  for (let voice = 0; voice < VOICE_COUNT; voice++) {
    voices.push(readVoiceFeatures(scan, frame, voice));
  }

  const cutoffLow = readRegister(scan, frame, FILTER_CUTOFF_LOW);
  const cutoffHigh = readRegister(scan, frame, FILTER_CUTOFF_HIGH);
  const resonanceRouting = readRegister(scan, frame, FILTER_RESONANCE_ROUTING);
  const volumeRegister = readRegister(scan, frame, FILTER_VOLUME);

  return {
    voices,
    cutoff: (cutoffHigh << 3) | (cutoffLow & 0x07),
    resonance: (resonanceRouting >> 4) & 0x0f,
    filterRouting: resonanceRouting & 0x0f,
    volume: volumeRegister & 0x0f,
    writeCount: scan.writeCounts[frame],
  };
}

function readVoiceFeatures(scan: ScanOutput, frame: number, voice: number): VoiceFeatures {
  const base = voice * REGISTERS_PER_VOICE;
  const freqLow = readRegister(scan, frame, base + 0);
  const freqHigh = readRegister(scan, frame, base + 1);
  const pulseLow = readRegister(scan, frame, base + 2);
  const pulseHigh = readRegister(scan, frame, base + 3);
  const control = readRegister(scan, frame, base + 4);

  return {
    frequency: (freqHigh << 8) | freqLow,
    pulseWidth: ((pulseHigh & 0x0f) << 8) | pulseLow,
    waveform: (control >> 4) & 0x0f,
    gate: (control & 0x01) !== 0,
    attackDecay: readRegister(scan, frame, base + 5),
    sustainRelease: readRegister(scan, frame, base + 6),
  };
}

function readRegister(scan: ScanOutput, frame: number, register: number): number {
  const slot = REGISTER_TO_SLOT[register];
  return scan.slotValues[frame * ASID_SLOT_COUNT + slot];
}

/** Dimension order is fixed and public: readers index it, so it is a contract, not an internal. */
export const FEATURE_DIMENSIONS: readonly string[] = [
  'voice0.pitch',
  'voice0.gate',
  'voice0.waveform',
  'voice0.envelope',
  'voice0.activity',
  'voice1.pitch',
  'voice1.gate',
  'voice1.waveform',
  'voice1.envelope',
  'voice1.activity',
  'voice2.pitch',
  'voice2.gate',
  'voice2.waveform',
  'voice2.envelope',
  'voice2.activity',
  'cutoff',
  'resonance',
  'filterRouting',
  'volume',
  'writeDensity',
];

export const FEATURE_DIMENSION_COUNT = FEATURE_DIMENSIONS.length;

const DIMENSIONS_PER_VOICE = 5;
const MAX_FREQUENCY = 0xffff;
const MAX_WAVEFORM_CODE = 0x0f;
const MAX_ENVELOPE_REGISTER_PAIR = 0xffff;
const MAX_CUTOFF = 0x07ff;
const MAX_RESONANCE = 0x0f;
const MAX_FILTER_ROUTING = 0x0f;
const MAX_VOLUME = 0x0f;

export interface FeatureMatrix {
  /** frames × FEATURE_DIMENSION_COUNT, flat and row-major; every value normalised to 0..1. */
  readonly values: Float32Array;
  readonly frames: number;
}

/**
 * Decodes every frame of a scan once into the shared normalised matrix both the novelty curve and
 * the similarity square weight against — decoding it twice per reader is how they'd come to disagree
 * about one tune, and re-decoding it on every weight-slider move would allocate tens of thousands of
 * objects per drag tick.
 */
export function buildFeatureMatrix(scan: ScanOutput): FeatureMatrix {
  const { frames } = scan;
  const values = new Float32Array(frames * FEATURE_DIMENSION_COUNT);
  const maxWriteCount = observedMax(scan.writeCounts, frames);

  for (let f = 0; f < frames; f++) {
    const features = readFrameFeatures(scan, f);
    const row = f * FEATURE_DIMENSION_COUNT;

    for (let voice = 0; voice < VOICE_COUNT; voice++) {
      const voiceFeatures = features.voices[voice];
      const base = row + voice * DIMENSIONS_PER_VOICE;
      // Activity mirrors gate exactly: a voice is active precisely when its gate is on, and the
      // transition to silence has to move the vector as far as the transition to sound — this is the
      // dimension a drop-out shows up on.
      const active = voiceFeatures.gate ? 1 : 0;
      values[base + 0] = normalisedPitch(voiceFeatures.frequency);
      values[base + 1] = active;
      values[base + 2] = voiceFeatures.waveform / MAX_WAVEFORM_CODE;
      values[base + 3] = normalisedEnvelope(voiceFeatures.attackDecay, voiceFeatures.sustainRelease);
      values[base + 4] = active;
    }

    const globalBase = row + VOICE_COUNT * DIMENSIONS_PER_VOICE;
    values[globalBase + 0] = features.cutoff / MAX_CUTOFF;
    values[globalBase + 1] = features.resonance / MAX_RESONANCE;
    values[globalBase + 2] = features.filterRouting / MAX_FILTER_ROUTING;
    values[globalBase + 3] = features.volume / MAX_VOLUME;
    values[globalBase + 4] = maxWriteCount === 0 ? 0 : features.writeCount / maxWriteCount;
  }

  return { values, frames };
}

function observedMax(writeCounts: Uint8Array, frames: number): number {
  let max = 0;
  for (let f = 0; f < frames; f++) {
    if (writeCounts[f] > max) {
      max = writeCounts[f];
    }
  }
  return max;
}

/** A register delta of 500 means something completely different at the bottom and the top of the
 *  frequency range, so pitch is normalised log frequency rather than a scaled register value. */
function normalisedPitch(frequency: number): number {
  return Math.log2(frequency + 1) / Math.log2(MAX_FREQUENCY + 1);
}

function normalisedEnvelope(attackDecay: number, sustainRelease: number): number {
  return ((attackDecay << 8) | sustainRelease) / MAX_ENVELOPE_REGISTER_PAIR;
}

/** frames * (nominalIntervalUs / callsPerFrame) / 1_000_000 — every reader needs this, and every
 *  reader would otherwise get the multispeed factor wrong. */
export function framesToSeconds(frames: number, nominalIntervalUs: number, callsPerFrame: number): number {
  return (frames * (nominalIntervalUs / callsPerFrame)) / 1_000_000;
}
