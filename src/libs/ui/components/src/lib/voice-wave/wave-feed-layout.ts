/**
 * The transferred buffer both sides of the voice-wave feed read and write. One `Float64Array`: a
 * header, then entries of a fixed stride, oldest first.
 *
 * Header: `[entryCount, restarted (0|1), dropped]`. Entry: `[timeMs, voice 0 fields…, voice 1 fields…,
 * voice 2 fields…]`, where `timeMs` is the engine's delivery time on the main thread's
 * `performance.now()` clock.
 */
export const WAVE_VOICE_COUNT = 3;

/** Never less than the application's delivery-history capacity (64). */
export const WAVE_FEED_MAX_ENTRIES = 128;

export const WAVE_HEADER_LENGTH = 3;
export const WAVE_HEADER_COUNT = 0;
export const WAVE_HEADER_RESTARTED = 1;
export const WAVE_HEADER_DROPPED = 2;

/** frequency, waveform, pulseWidth, ring, sync, attack, decay, sustain, release, gate, hit. */
export const WAVE_VOICE_FIELDS = 11;
export const WAVE_ENTRY_STRIDE = 1 + WAVE_VOICE_COUNT * WAVE_VOICE_FIELDS;
export const WAVE_FEED_LENGTH = WAVE_HEADER_LENGTH + WAVE_FEED_MAX_ENTRIES * WAVE_ENTRY_STRIDE;

/**
 * Field offsets within one voice's block. Ranges: `frequency` 0…65535 as sent; `waveform` 0…15 (the
 * bits below); `pulseWidth` 0…4095; `ring` and `sync` 0|1; the four envelope settings 0…15; `gate`
 * 0|1 as the entry ends; `hit` 0|1, whether the gate went closed to open within the entry (an entry
 * carries at most two control bytes per voice, so at most once).
 */
export const WaveField = {
  Frequency: 0,
  Waveform: 1,
  PulseWidth: 2,
  Ring: 3,
  Sync: 4,
  Attack: 5,
  Decay: 6,
  Sustain: 7,
  Release: 8,
  Gate: 9,
  Hit: 10,
} as const;

/** The waveform field's bits. */
export const WAVEFORM_TRIANGLE = 1;
export const WAVEFORM_SAWTOOTH = 2;
export const WAVEFORM_PULSE = 4;
export const WAVEFORM_NOISE = 8;
