import { readFrameFeatures } from './frame-features';
import type { ScanOutput } from './scan-tune';
import type { SidClock } from '../sid/sid-file.model';

/**
 * One sounding pitch on one voice, for as long as it sounded.
 *
 * Pitch is carried in hertz only. A pitch class deliberately does not live here: it cannot be
 * computed until the tuning is known, and the tuning is recovered from the set of hertz values these
 * notes carry, so putting one here would make the derivation circular.
 *
 * `endFrame` is exclusive — `endFrame - startFrame` is the duration in play-routine frames.
 */
export interface Note {
  readonly voice: number; // 0..2
  readonly startFrame: number;
  readonly endFrame: number;
  readonly hz: number; // sounding pitch, clock-corrected, tuning-independent
}

/**
 * CPU clock rates the SID's oscillator is derived from. The two differ by about 3.8% — roughly 65
 * cents, over a quarter tone — which is enough to name the wrong key on its own.
 *
 * These live here rather than in `asid-constants`, which holds frame intervals: a frame interval and
 * an oscillator clock are different quantities that happen to both be timings.
 */
export const PAL_CPU_CLOCK_HZ = 985_248;
export const NTSC_CPU_CLOCK_HZ = 1_022_727;

/** The SID's phase accumulator is 24-bit; the frequency register is its per-cycle increment. */
const PHASE_ACCUMULATOR_STEPS = 2 ** 24;

/** Control bits 4..7 are shifted down into `VoiceFeatures.waveform`, so noise reads as 0x08 there. */
const NOISE_WAVEFORM_BIT = 0x08;

/**
 * A change this large is a new note; anything smaller is the same note moving. Vibrato on the SID
 * wobbles by well under a semitone and returns; an arpeggio jumps several semitones and stays.
 */
const ARPEGGIO_STEP_SEMITONES = 1;

const VOICE_COUNT = 3;

/** PAL for `'unknown'` and `'any'` — the overwhelming majority of the library, and the only choice
 *  that is a guess rather than a coin toss. */
export function cpuClockHzFor(clock: SidClock): number {
  return clock === 'ntsc' ? NTSC_CPU_CLOCK_HZ : PAL_CPU_CLOCK_HZ;
}

/** `freqRegister * cpuClockHz / 2**24` — the SID's own oscillator formula. */
export function registerToHz(freqRegister: number, clock: SidClock): number {
  return (freqRegister * cpuClockHzFor(clock)) / PHASE_ACCUMULATOR_STEPS;
}

interface OpenSegment {
  startFrame: number;
  readonly registers: number[];
  lastRegister: number;
}

/**
 * Splits a scan into the notes each voice actually sounded.
 *
 * Two behaviours carry the whole result:
 *
 * - A chord on a C64 is one voice cycling between pitches with the gate held down. Each distinct
 *   pitch in that cycle becomes its own note with the duration it really sounded, so the harmony
 *   survives; averaging the cycle would collapse a triad to its middle note and lose it silently.
 * - A vibrato is the same note moving, so it collapses to the median pitch across the note rather
 *   than fragmenting into dozens of one-frame notes.
 *
 * A voice selecting the noise waveform contributes no pitch and is dropped — in audio key detection
 * percussion is the largest single source of error, and here it can simply be excluded.
 */
export function segmentNotes(scan: ScanOutput, clock: SidClock): readonly Note[] {
  const notes: Note[] = [];
  const open: (OpenSegment | null)[] = new Array<OpenSegment | null>(VOICE_COUNT).fill(null);

  for (let frame = 0; frame < scan.frames; frame++) {
    const features = readFrameFeatures(scan, frame);
    for (let voice = 0; voice < VOICE_COUNT; voice++) {
      const voiceFeatures = features.voices[voice];
      const register = voiceFeatures.frequency;
      const sounding =
        voiceFeatures.gate && (voiceFeatures.waveform & NOISE_WAVEFORM_BIT) === 0 && register > 0;

      const segment = open[voice];
      if (!sounding) {
        if (segment !== null) {
          notes.push(closeSegment(segment, voice, frame, clock));
          open[voice] = null;
        }
        continue;
      }

      if (segment === null) {
        open[voice] = { startFrame: frame, registers: [register], lastRegister: register };
        continue;
      }

      if (semitonesBetween(register, segment.lastRegister) >= ARPEGGIO_STEP_SEMITONES) {
        notes.push(closeSegment(segment, voice, frame, clock));
        open[voice] = { startFrame: frame, registers: [register], lastRegister: register };
        continue;
      }

      segment.registers.push(register);
      segment.lastRegister = register;
    }
  }

  for (let voice = 0; voice < VOICE_COUNT; voice++) {
    const segment = open[voice];
    if (segment !== null) {
      notes.push(closeSegment(segment, voice, scan.frames, clock));
    }
  }

  notes.sort((a, b) => a.startFrame - b.startFrame || a.voice - b.voice);
  return notes;
}

function closeSegment(
  segment: OpenSegment,
  voice: number,
  endFrame: number,
  clock: SidClock
): Note {
  return {
    voice,
    startFrame: segment.startFrame,
    endFrame,
    hz: registerToHz(medianRegister(segment.registers), clock),
  };
}

/** The lower middle rather than the mean of the two middles, so the collapsed pitch is always a
 *  value the player actually wrote — averaging two table entries can land between semitones. */
function medianRegister(registers: readonly number[]): number {
  const sorted = [...registers].sort((a, b) => a - b);
  return sorted[(sorted.length - 1) >> 1];
}

/** Register values are proportional to hertz, so semitone distance needs no clock correction. */
function semitonesBetween(a: number, b: number): number {
  return Math.abs(12 * Math.log2(a / b));
}
