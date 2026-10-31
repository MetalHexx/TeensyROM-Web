import { describe, it, expect } from 'vitest';
import { WaveBankModel } from './model/wave-bank-model';
import type { WaveVoiceView } from './model/wave-view';
import { WaveStream } from './model/wave-stream.mock';
import { WaveFeedBuffer, type WaveVoiceFields } from './wave-feed-buffer';
import {
  WAVEFORM_PULSE,
  WAVEFORM_SAWTOOTH,
  WAVE_ENTRY_STRIDE,
  WAVE_FEED_LENGTH,
  WAVE_FEED_MAX_ENTRIES,
  WAVE_HEADER_COUNT,
  WAVE_HEADER_DROPPED,
  WAVE_HEADER_LENGTH,
  WAVE_HEADER_RESTARTED,
  WAVE_VOICE_FIELDS,
  WaveField,
} from './wave-feed-layout';

const SILENT: WaveVoiceFields = {
  frequency: 0,
  waveform: 0,
  pulseWidth: 0,
  ring: 0,
  sync: 0,
  attack: 0,
  decay: 0,
  sustain: 0,
  release: 0,
  gate: 0,
  hit: 0,
};

const LEAD: WaveVoiceFields = {
  frequency: 1200,
  waveform: WAVEFORM_PULSE,
  pulseWidth: 2048,
  ring: 0,
  sync: 0,
  attack: 2,
  decay: 5,
  sustain: 8,
  release: 6,
  gate: 1,
  hit: 1,
};

const BASS: WaveVoiceFields = {
  ...LEAD,
  frequency: 300,
  waveform: WAVEFORM_SAWTOOTH,
  hit: 0,
};

function offset(entry: number): number {
  return WAVE_HEADER_LENGTH + entry * WAVE_ENTRY_STRIDE;
}

function header(buffer: WaveFeedBuffer): number[] {
  return Array.from(buffer.array.subarray(0, WAVE_HEADER_LENGTH));
}

function snapshot(view: WaveVoiceView): WaveVoiceView {
  return { ...view };
}

describe('WaveFeedBuffer', () => {
  it('reproduces the written entries through the model', () => {
    const buffer = new WaveFeedBuffer();
    buffer.beginEntry(100);
    buffer.setVoice(0, LEAD);
    buffer.setVoice(1, BASS);
    buffer.beginEntry(120);
    buffer.setVoice(0, { ...LEAD, hit: 0 });
    buffer.setVoice(1, BASS);
    buffer.beginEntry(140);
    buffer.setVoice(0, { ...LEAD, hit: 0, gate: 0 });
    buffer.setVoice(1, BASS);
    buffer.finish(false, 0);

    const expected = new WaveStream(80);
    expected.entry({ 0: LEAD, 1: BASS });
    expected.entry({ 0: { hit: 0 } });
    expected.entry({ 0: { gate: 0 } });

    const fromBuffer = new WaveBankModel();
    const fromStream = new WaveBankModel();
    for (let i = 0; i < 3; i++) {
      fromBuffer.ingestEntry(buffer.array, offset(i));
      fromStream.ingestEntry(expected.data, expected.offset(i));
      fromBuffer.step(100 + 20 * i + 5);
      fromStream.step(100 + 20 * i + 5);
      for (const voice of [0, 1, 2] as const) {
        expect(snapshot(fromBuffer.view(voice))).toEqual(snapshot(fromStream.view(voice)));
      }
    }
    expect(fromBuffer.view(0).sounding).toBe(true);
    expect(fromBuffer.view(1).sounding).toBe(true);
    expect(fromBuffer.view(2).sounding).toBe(false);
  });

  it('lays each field of a voice at its offset in the entry', () => {
    const buffer = new WaveFeedBuffer();
    buffer.beginEntry(42);
    buffer.setVoice(2, LEAD);
    buffer.finish(false, 0);

    const entry = offset(0);
    const voice = entry + 1 + 2 * WAVE_VOICE_FIELDS;
    expect(buffer.array[entry]).toBe(42);
    expect(buffer.array[voice + WaveField.Frequency]).toBe(LEAD.frequency);
    expect(buffer.array[voice + WaveField.PulseWidth]).toBe(LEAD.pulseWidth);
    expect(buffer.array[voice + WaveField.Sustain]).toBe(LEAD.sustain);
    expect(buffer.array[voice + WaveField.Hit]).toBe(1);
  });

  it('fills the header on finish', () => {
    const buffer = new WaveFeedBuffer();
    buffer.beginEntry(1);
    buffer.beginEntry(2);

    buffer.finish(true, 4);

    expect(header(buffer)).toEqual([2, 1, 4]);
    expect(buffer.entryCount).toBe(2);
  });

  it('starts each entry with every voice silent, whatever the buffer held before', () => {
    const buffer = new WaveFeedBuffer();
    buffer.beginEntry(1);
    buffer.setVoice(0, LEAD);
    buffer.setVoice(1, LEAD);
    buffer.finish(false, 0);

    buffer.reset();
    buffer.beginEntry(2);
    buffer.setVoice(1, SILENT);
    buffer.finish(false, 0);

    const entry = buffer.array.subarray(offset(0), offset(1));
    expect(entry[0]).toBe(2);
    expect(entry.subarray(1).every((value) => value === 0)).toBe(true);
  });

  it('empties on reset: header zeroed and the next entry back at the start', () => {
    const buffer = new WaveFeedBuffer();
    buffer.beginEntry(1);
    buffer.beginEntry(2);
    buffer.finish(true, 3);

    buffer.reset();

    expect(header(buffer)).toEqual([0, 0, 0]);
    expect(buffer.entryCount).toBe(0);
    buffer.beginEntry(9);
    buffer.finish(false, 0);
    expect(buffer.array[offset(0)]).toBe(9);
    expect(header(buffer)).toEqual([1, 0, 0]);
  });

  it('ignores entries past the maximum and counts them into dropped', () => {
    const buffer = new WaveFeedBuffer();
    for (let i = 0; i < WAVE_FEED_MAX_ENTRIES; i++) {
      buffer.beginEntry(i);
      buffer.setVoice(0, LEAD);
    }
    const last = offset(WAVE_FEED_MAX_ENTRIES - 1);
    const before = Array.from(buffer.array.subarray(last, last + WAVE_ENTRY_STRIDE));

    buffer.beginEntry(1000);
    buffer.setVoice(0, BASS);
    buffer.beginEntry(1001);
    buffer.setVoice(0, BASS);
    buffer.finish(false, 2);

    expect(buffer.array[WAVE_HEADER_COUNT]).toBe(WAVE_FEED_MAX_ENTRIES);
    expect(buffer.array[WAVE_HEADER_RESTARTED]).toBe(0);
    expect(buffer.array[WAVE_HEADER_DROPPED]).toBe(4);
    expect(Array.from(buffer.array.subarray(last, last + WAVE_ENTRY_STRIDE))).toEqual(before);
    expect(buffer.array.length).toBe(WAVE_FEED_LENGTH);
  });

  it('ignores a voice outside 0 to 2 rather than writing into the next entry', () => {
    const buffer = new WaveFeedBuffer();
    buffer.beginEntry(1);
    buffer.setVoice(3, LEAD);
    buffer.beginEntry(2);

    expect(buffer.array.subarray(offset(1) + 1, offset(2)).every((value) => value === 0)).toBe(
      true
    );
  });

  it('adopts the array that comes back from a transfer, emptied', () => {
    const buffer = new WaveFeedBuffer();
    buffer.beginEntry(1);
    buffer.setVoice(0, LEAD);
    buffer.finish(false, 0);
    const sent = buffer.array;
    const returned = new Float64Array(structuredClone(sent.buffer, { transfer: [sent.buffer] }));
    expect(sent.length).toBe(0);

    buffer.rewrap(returned);

    expect(buffer.array).toBe(returned);
    expect(header(buffer)).toEqual([0, 0, 0]);
    buffer.beginEntry(7);
    buffer.finish(false, 0);
    expect(returned[offset(0)]).toBe(7);
    expect(returned[WAVE_HEADER_COUNT]).toBe(1);
  });

  it('refuses an array of the wrong size, such as one still detached', () => {
    const buffer = new WaveFeedBuffer();
    const sent = buffer.array;
    structuredClone(sent.buffer, { transfer: [sent.buffer] });

    expect(() => buffer.rewrap(sent)).toThrow(RangeError);
    expect(() => new WaveFeedBuffer(new Float64Array(10))).toThrow(RangeError);
  });
});
