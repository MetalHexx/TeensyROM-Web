import {
  WAVEFORM_NOISE,
  WAVEFORM_PULSE,
  WAVEFORM_SAWTOOTH,
  WAVEFORM_TRIANGLE,
} from '../wave-feed-layout';
import type { WaveVoiceView } from './wave-view';

/** The window always shows between these many waves, whatever the pitch. */
export const WAVE_CYCLES_LOW = 1.5;
export const WAVE_CYCLES_HIGH = 7;
/** The log2 of the frequency that shows `WAVE_CYCLES_LOW` and the number of octaves up to `WAVE_CYCLES_HIGH`. */
export const WAVE_FREQUENCY_LOG_LOW = 8;
export const WAVE_FREQUENCY_LOG_SPAN = 8;

export const PULSE_DUTY_MIN = 0.05;
export const PULSE_DUTY_MAX = 0.95;
const PULSE_WIDTH_MAX = 4095;

/** Ring and sync read the source's real frequency ratio, kept to this band and to this many cycles. */
export const SOURCE_RATIO_MIN = 1 / 6;
export const SOURCE_RATIO_MAX = 6;
export const SOURCE_CYCLES_MAX = 14;

/** Noise is re-rolled this many times a second, and has this many steps per wave. */
export const NOISE_RATE_HZ = 20;
export const NOISE_BUCKETS_PER_CYCLE = 6;

/** The voice whose oscillator a voice's ring and sync read: 0 from 2, 1 from 0, 2 from 1. */
export const WAVE_SOURCE_OF = [2, 0, 1] as const;

/** Waves shown for a SID frequency register value on the log scale; 0 is silent and shows 0. */
export function cyclesForFrequency(frequency: number): number {
  if (!(frequency > 0)) return 0;
  const position = (Math.log2(frequency) - WAVE_FREQUENCY_LOG_LOW) / WAVE_FREQUENCY_LOG_SPAN;
  const t = position < 0 ? 0 : position > 1 ? 1 : position;
  return WAVE_CYCLES_LOW + (WAVE_CYCLES_HIGH - WAVE_CYCLES_LOW) * t;
}

/** A pulse's high fraction for a 12-bit pulse width, kept off 0 and 1 so the wave never vanishes. */
export function dutyForPulseWidth(pulseWidth: number): number {
  const duty = pulseWidth / PULSE_WIDTH_MAX;
  return duty < PULSE_DUTY_MIN ? PULSE_DUTY_MIN : duty > PULSE_DUTY_MAX ? PULSE_DUTY_MAX : duty;
}

/**
 * The cycles to show for a ring or sync source: the voice's own cycles scaled by the real ratio of
 * the two frequencies, so a source an octave up shows twice the waves. A silent source, or voice, has
 * no effect (0).
 */
export function sourceCycles(
  sourceFrequency: number,
  voiceFrequency: number,
  voiceCycles: number
): number {
  if (!(sourceFrequency > 0) || !(voiceFrequency > 0)) return 0;
  const ratio = sourceFrequency / voiceFrequency;
  const kept =
    ratio < SOURCE_RATIO_MIN
      ? SOURCE_RATIO_MIN
      : ratio > SOURCE_RATIO_MAX
      ? SOURCE_RATIO_MAX
      : ratio;
  const cycles = voiceCycles * kept;
  return cycles > SOURCE_CYCLES_MAX ? SOURCE_CYCLES_MAX : cycles;
}

/** A hashed value in -1…1, the same for the same bucket and noise step. */
export function noiseValue(bucket: number, step: number): number {
  let h = Math.imul(bucket | 0, 374761393) + Math.imul(step | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 2147483647.5 - 1;
}

/**
 * One point of a voice's wave, -1…1, at `u` 0…1 across the window. Waveforms set together draw as the
 * average of their shapes; none set is flat. The shape is stationary: only the view and `noiseStep`
 * change it. Ring inverts only the triangle each half-cycle of the source; sync restarts the phase on
 * every source cycle.
 */
export function waveSample(view: WaveVoiceView, u: number, noiseStep: number): number {
  const waveform = view.waveform;
  if (waveform === 0 || view.cycles <= 0) return 0;

  let phase = u * view.cycles;
  if (view.syncCycles > 0) {
    const source = u * view.syncCycles;
    phase = ((source - Math.floor(source)) / view.syncCycles) * view.cycles;
  }
  const cyclePhase = phase - Math.floor(phase);

  let sum = 0;
  let shapes = 0;
  if ((waveform & WAVEFORM_TRIANGLE) !== 0) {
    let triangle = cyclePhase < 0.5 ? 4 * cyclePhase - 1 : 3 - 4 * cyclePhase;
    if (view.ringCycles > 0) {
      const ring = u * view.ringCycles;
      if (ring - Math.floor(ring) >= 0.5) triangle = -triangle;
    }
    sum += triangle;
    shapes++;
  }
  if ((waveform & WAVEFORM_SAWTOOTH) !== 0) {
    sum += 2 * cyclePhase - 1;
    shapes++;
  }
  if ((waveform & WAVEFORM_PULSE) !== 0) {
    sum += cyclePhase < view.duty ? 1 : -1;
    shapes++;
  }
  if ((waveform & WAVEFORM_NOISE) !== 0) {
    sum += noiseValue(Math.floor(phase * NOISE_BUCKETS_PER_CYCLE), noiseStep);
    shapes++;
  }
  return shapes === 0 ? 0 : sum / shapes;
}
