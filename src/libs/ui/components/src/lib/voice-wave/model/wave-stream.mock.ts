import {
  WAVE_ENTRY_STRIDE,
  WAVE_FEED_LENGTH,
  WAVE_FEED_MAX_ENTRIES,
  WAVE_HEADER_LENGTH,
  WAVE_VOICE_COUNT,
  WAVE_VOICE_FIELDS,
  WaveField,
} from '../wave-feed-layout';
import type { WaveBankModel } from './wave-bank-model';
import type { WaveVoice, WaveVoiceView } from './wave-view';

type FieldName = keyof typeof WaveField;

/** A voice's fields by name, in the feed's raw units; unnamed fields keep their last value. */
export type VoiceChange = Partial<Record<Uncapitalize<FieldName>, number>>;

export type EntryChange = Partial<Record<WaveVoice, VoiceChange>>;

export const FRAME_MS = 20;

/**
 * Builds a scenario as a feed buffer: each `entry` moves the clock on and applies changes to chosen
 * voices, which keep their other fields from the entry before. `hit` is the one field that never
 * carries over. Entries sit at the feed's real offsets.
 */
export class WaveStream {
  readonly data = new Float64Array(WAVE_FEED_LENGTH);
  count = 0;

  private clock: number;
  private readonly held = new Float64Array(WAVE_VOICE_COUNT * WAVE_VOICE_FIELDS);

  constructor(startMs = 0) {
    this.clock = startMs;
  }

  get timeMs(): number {
    return this.clock;
  }

  entry(changes: EntryChange = {}, afterMs = FRAME_MS): this {
    if (this.count === WAVE_FEED_MAX_ENTRIES) throw new Error('scenario longer than one feed');
    this.clock += afterMs;
    const base = WAVE_HEADER_LENGTH + this.count * WAVE_ENTRY_STRIDE;
    this.data[base] = this.clock;
    for (let voice = 0; voice < WAVE_VOICE_COUNT; voice++) {
      const at = voice * WAVE_VOICE_FIELDS;
      this.held[at + WaveField.Hit] = 0;
      const change = changes[voice as WaveVoice];
      if (change) {
        for (const [name, value] of Object.entries(change)) {
          const field = WaveField[(name[0].toUpperCase() + name.slice(1)) as FieldName];
          this.held[at + field] = value;
        }
      }
      this.data.set(this.held.subarray(at, at + WAVE_VOICE_FIELDS), base + 1 + at);
    }
    this.count++;
    return this;
  }

  /** The same change on every one of `frames` consecutive entries. */
  repeat(frames: number, changes: EntryChange = {}, afterMs = FRAME_MS): this {
    for (let i = 0; i < frames; i++) this.entry(i === 0 ? changes : {}, afterMs);
    return this;
  }

  offset(entry: number): number {
    return WAVE_HEADER_LENGTH + entry * WAVE_ENTRY_STRIDE;
  }

  ingestAll(model: WaveBankModel): void {
    for (let i = 0; i < this.count; i++) model.ingestEntry(this.data, this.offset(i));
  }

  /** Ingests each entry then steps to its time, recording `read(view)` after every step. */
  trace(model: WaveBankModel, voice: WaveVoice, read: (view: WaveVoiceView) => number): number[] {
    const values: number[] = [];
    for (let i = 0; i < this.count; i++) {
      model.ingestEntry(this.data, this.offset(i));
      model.step(this.data[this.offset(i)]);
      values.push(read(model.view(voice)));
    }
    return values;
  }
}

/** The amplitude after each entry of the stream, for one voice. */
export function amplitudes(model: WaveBankModel, stream: WaveStream, voice: WaveVoice): number[] {
  return stream.trace(model, voice, (view) => view.amplitude);
}
