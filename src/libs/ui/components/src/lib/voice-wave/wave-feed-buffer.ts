import {
  WAVE_ENTRY_STRIDE,
  WAVE_FEED_LENGTH,
  WAVE_FEED_MAX_ENTRIES,
  WAVE_HEADER_COUNT,
  WAVE_HEADER_DROPPED,
  WAVE_HEADER_LENGTH,
  WAVE_HEADER_RESTARTED,
  WAVE_VOICE_COUNT,
  WAVE_VOICE_FIELDS,
  WaveField,
} from './wave-feed-layout';

/** One voice's decoded register state for an entry, in the feed's raw units (see `WaveField`). */
export interface WaveVoiceFields {
  frequency: number;
  waveform: number;
  pulseWidth: number;
  ring: number;
  sync: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  gate: number;
  hit: number;
}

function checked(buffer: Float64Array): Float64Array {
  if (buffer.length !== WAVE_FEED_LENGTH) {
    throw new RangeError(
      `a wave feed buffer holds ${WAVE_FEED_LENGTH} numbers, not ${buffer.length}`
    );
  }
  return buffer;
}

/**
 * Writes entries into one pooled `Float64Array` in the feed layout. The array is what gets
 * transferred to the worker, which detaches it on this side; `rewrap` adopts it again when the worker
 * sends it back.
 *
 * The writer contract (`beginEntry`, `setVoice`, `finish`) allocates nothing. An entry that does not
 * fit is ignored whole and counted into the header's `dropped`, so the reader restarts rather than
 * trusting a feed with a hole in it.
 */
export class WaveFeedBuffer {
  private data: Float64Array;
  private entries = 0;
  private ignored = 0;
  private base = 0;
  private writing = false;

  constructor(buffer: Float64Array = new Float64Array(WAVE_FEED_LENGTH)) {
    this.data = checked(buffer);
  }

  /** The array to transfer. */
  get array(): Float64Array {
    return this.data;
  }

  /** How many entries are written since the last `reset`. */
  get entryCount(): number {
    return this.entries;
  }

  /** Starts the next entry at `timeMs` (the main thread's `performance.now()`), with every voice zeroed. */
  beginEntry(timeMs: number): void {
    if (this.entries >= WAVE_FEED_MAX_ENTRIES) {
      this.ignored++;
      this.writing = false;
      return;
    }
    this.base = WAVE_HEADER_LENGTH + this.entries * WAVE_ENTRY_STRIDE;
    this.data.fill(0, this.base + 1, this.base + WAVE_ENTRY_STRIDE);
    this.data[this.base] = timeMs;
    this.entries++;
    this.writing = true;
  }

  /** Sets one voice (0…2) of the current entry; ignored when no entry is open or the voice is out of range. */
  setVoice(voice: number, fields: WaveVoiceFields): void {
    if (!this.writing || !(voice >= 0 && voice < WAVE_VOICE_COUNT)) return;
    const at = this.base + 1 + voice * WAVE_VOICE_FIELDS;
    const data = this.data;
    data[at + WaveField.Frequency] = fields.frequency;
    data[at + WaveField.Waveform] = fields.waveform;
    data[at + WaveField.PulseWidth] = fields.pulseWidth;
    data[at + WaveField.Ring] = fields.ring;
    data[at + WaveField.Sync] = fields.sync;
    data[at + WaveField.Attack] = fields.attack;
    data[at + WaveField.Decay] = fields.decay;
    data[at + WaveField.Sustain] = fields.sustain;
    data[at + WaveField.Release] = fields.release;
    data[at + WaveField.Gate] = fields.gate;
    data[at + WaveField.Hit] = fields.hit;
  }

  /** Fills the header: the entries written, whether the feed restarts, and `dropped` plus the entries that did not fit. */
  finish(restarted: boolean, dropped: number): void {
    this.data[WAVE_HEADER_COUNT] = this.entries;
    this.data[WAVE_HEADER_RESTARTED] = restarted ? 1 : 0;
    this.data[WAVE_HEADER_DROPPED] = dropped + this.ignored;
    this.writing = false;
  }

  /** Empties the buffer: the header zeroed and the write cursor back at the first entry. */
  reset(): void {
    this.data[WAVE_HEADER_COUNT] = 0;
    this.data[WAVE_HEADER_RESTARTED] = 0;
    this.data[WAVE_HEADER_DROPPED] = 0;
    this.entries = 0;
    this.ignored = 0;
    this.writing = false;
  }

  /** Adopts the array that came back from the worker, emptied, in place of the detached one. */
  rewrap(buffer: Float64Array): void {
    this.data = checked(buffer);
    this.reset();
  }
}
