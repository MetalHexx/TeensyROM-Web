import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  WAVEFORM_NOISE,
  WAVEFORM_PULSE,
  WAVEFORM_SAWTOOTH,
  WAVEFORM_TRIANGLE,
  WAVE_FEED_LENGTH,
  WAVE_HEADER_LENGTH,
  WAVE_VOICE_FIELDS,
} from '../wave-feed-layout';
import { WaveBankModel } from './wave-bank-model';
import { WAVE_CYCLES_HIGH, WAVE_CYCLES_LOW, noiseValue, waveSample } from './wave-shape';
import { WaveStream, amplitudes } from './wave-stream.mock';
import type { WaveVoice, WaveVoiceView } from './wave-view';

const PAD = { attack: 5, decay: 5, sustain: 8, release: 6 };
const SUSTAIN_LEVEL = 8 / 15;

function sampled(view: WaveVoiceView, step = 0): number[] {
  return Array.from({ length: 64 }, (_, i) => waveSample(view, i / 64, step));
}

function settled(stream: WaveStream, voice: WaveVoice = 0): WaveVoiceView {
  const model = new WaveBankModel();
  stream.ingestAll(model);
  model.step(stream.timeMs);
  return { ...model.view(voice) };
}

function sounding(voice: Record<string, number>): Record<string, number> {
  return { gate: 1, attack: 0, decay: 15, sustain: 15, release: 0, ...voice };
}

describe('WaveBankModel envelope', () => {
  it('rises through the attack, falls to the sustain level, holds while the gate is open, and falls through the release', () => {
    const stream = new WaveStream();
    stream.entry({ 0: { ...PAD, frequency: 1000, waveform: WAVEFORM_PULSE, gate: 1, hit: 1 } });
    stream.repeat(25);
    stream.entry({ 0: { gate: 0 } });
    stream.repeat(15);

    const values = amplitudes(new WaveBankModel(), stream, 0);

    const open = values.slice(0, 26);
    expect(open[0]).toBe(0);
    expect(open[1]).toBeGreaterThan(open[0]);
    expect(open[2]).toBeGreaterThan(open[1]);
    const peak = Math.max(...open);
    expect(peak).toBeGreaterThan(0.9);
    expect(open[open.indexOf(peak) + 1]).toBeLessThan(peak);
    expect(open[24]).toBeCloseTo(SUSTAIN_LEVEL, 2);
    expect(open[25]).toBeCloseTo(SUSTAIN_LEVEL, 2);

    const released = values.slice(26);
    for (let i = 1; i < released.length; i++)
      expect(released[i]).toBeLessThanOrEqual(released[i - 1]);
    expect(released[0]).toBeCloseTo(SUSTAIN_LEVEL, 2);
    expect(released[1]).toBeLessThan(SUSTAIN_LEVEL);
    expect(released[released.length - 1]).toBe(0);
  });

  it('lifts a one-frame hit from the current height and then releases', () => {
    const stream = new WaveStream();
    stream.entry({
      0: {
        frequency: 1000,
        waveform: WAVEFORM_PULSE,
        attack: 0,
        decay: 3,
        sustain: 0,
        release: 4,
        gate: 0,
        hit: 1,
      },
    });
    stream.repeat(10);

    const values = amplitudes(new WaveBankModel(), stream, 0);

    expect(values[0]).toBeGreaterThan(0.5);
    expect(values[1]).toBeLessThan(values[0]);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
  });

  it('restarts the attack from the current height when a note retriggers during a release', () => {
    const stream = new WaveStream();
    stream.entry({
      0: {
        frequency: 1000,
        waveform: WAVEFORM_PULSE,
        attack: 0,
        decay: 6,
        sustain: 15,
        release: 7,
        gate: 1,
        hit: 1,
      },
    });
    stream.repeat(10);
    stream.entry({ 0: { gate: 0 } });
    stream.entry();
    stream.entry({ 0: { attack: 9, gate: 1, hit: 1 } });
    stream.entry();

    const values = amplitudes(new WaveBankModel(), stream, 0);

    const closed = 11;
    const retriggered = values[closed + 2];
    expect(values[closed + 1]).toBeLessThan(values[closed]);
    expect(retriggered).toBeGreaterThan(0.2);
    expect(retriggered).toBeLessThan(values[closed + 1]);
    expect(values[closed + 3]).toBeGreaterThan(retriggered);
  });

  it('shows the sustain level for an open gate with no hit on an idle follower, including after a restart', () => {
    const stream = new WaveStream();
    stream.entry({ 0: { frequency: 1000, waveform: WAVEFORM_TRIANGLE, ...PAD, gate: 1 } });
    const model = new WaveBankModel();
    stream.ingestAll(model);
    model.step(stream.timeMs);
    expect(model.view(0).amplitude).toBeCloseTo(SUSTAIN_LEVEL, 3);

    model.restart();
    expect(model.view(0).amplitude).toBe(0);
    expect(model.view(0).sounding).toBe(false);

    const again = new WaveStream(5000);
    again.entry({ 0: { frequency: 1000, waveform: WAVEFORM_TRIANGLE, ...PAD, gate: 1 } });
    again.ingestAll(model);
    model.step(again.timeMs);
    expect(model.view(0).amplitude).toBeCloseTo(SUSTAIN_LEVEL, 3);
  });

  it('never skips an entry when several are ingested between steps', () => {
    const stream = new WaveStream();
    for (let i = 0; i < 3; i++) {
      stream.entry({
        0: {
          frequency: 1000,
          waveform: WAVEFORM_PULSE,
          attack: 0,
          decay: 1,
          sustain: 0,
          release: 1,
          gate: 1,
          hit: 1,
        },
      });
      stream.entry({ 0: { gate: 0 } });
    }
    const model = new WaveBankModel();

    stream.ingestAll(model);

    expect(model.attackCount(0)).toBe(3);
  });

  it('carries no pending hit across a restart', () => {
    const stream = new WaveStream();
    stream.entry({ 0: { frequency: 1000, waveform: WAVEFORM_PULSE, ...PAD, gate: 1, hit: 1 } });
    const model = new WaveBankModel();
    stream.ingestAll(model);

    model.restart();
    model.step(stream.timeMs + 10);

    for (const voice of [0, 1, 2] as const) {
      expect(model.view(voice).amplitude).toBe(0);
      expect(model.view(voice).sounding).toBe(false);
    }
    const next = new WaveStream(stream.timeMs + 20);
    next.entry({ 0: { frequency: 1000, waveform: WAVEFORM_PULSE, ...PAD, gate: 1 } });
    next.ingestAll(model);
    model.step(next.timeMs);
    expect(model.view(0).amplitude).toBeCloseTo(SUSTAIN_LEVEL, 3);
  });

  it('draws a muted voice (waveform 0) and a voice at frequency 0 flat at once', () => {
    const muted = settled(
      new WaveStream().entry({ 0: sounding({ frequency: 1000, waveform: 0 }) })
    );
    const silent = settled(
      new WaveStream().entry({ 0: sounding({ frequency: 0, waveform: WAVEFORM_PULSE }) })
    );

    for (const view of [muted, silent]) {
      expect(view.sounding).toBe(false);
      expect(view.amplitude).toBe(0);
      expect(sampled(view).every((value) => value === 0)).toBe(true);
    }
  });
});

describe('WaveBankModel shape', () => {
  it('draws a blend of waveforms differently from each alone', () => {
    const one = (waveform: number) =>
      sampled(
        settled(
          new WaveStream().entry({ 0: sounding({ frequency: 1000, waveform, pulseWidth: 1000 }) })
        )
      );
    const triangle = one(WAVEFORM_TRIANGLE);
    const saw = one(WAVEFORM_SAWTOOTH);
    const blend = one(WAVEFORM_TRIANGLE | WAVEFORM_SAWTOOTH);

    expect(blend).not.toEqual(triangle);
    expect(blend).not.toEqual(saw);
    expect(one(WAVEFORM_PULSE | WAVEFORM_SAWTOOTH)).not.toEqual(blend);
  });

  it('follows pulse width with the duty, kept off the ends', () => {
    const duty = (pulseWidth: number) =>
      settled(
        new WaveStream().entry({
          0: sounding({ frequency: 1000, waveform: WAVEFORM_PULSE, pulseWidth }),
        })
      ).duty;

    const sweep = [0, 512, 1024, 2048, 3072, 4095].map(duty);

    for (let i = 1; i < sweep.length; i++) expect(sweep[i]).toBeGreaterThan(sweep[i - 1]);
    expect(sweep[0]).toBeGreaterThan(0);
    expect(sweep[sweep.length - 1]).toBeLessThan(1);
    const view = settled(
      new WaveStream().entry({
        0: sounding({ frequency: 1000, waveform: WAVEFORM_PULSE, pulseWidth: 1024 }),
      })
    );
    const high = sampled(view).filter((value) => value > 0).length / 64;
    expect(Math.abs(high - view.duty)).toBeLessThan(0.1);
  });

  it('changes noise from one step to the next but not within a step', () => {
    const view = settled(
      new WaveStream().entry({ 0: sounding({ frequency: 1000, waveform: WAVEFORM_NOISE }) })
    );

    expect(sampled(view, 3)).toEqual(sampled(view, 3));
    expect(sampled(view, 3)).not.toEqual(sampled(view, 4));
    expect(noiseValue(5, 7)).toBeGreaterThanOrEqual(-1);
    expect(noiseValue(5, 7)).toBeLessThanOrEqual(1);
  });

  it('moves cycles monotonically across the log band, within its clamp', () => {
    const cycles = [50, 100, 300, 1000, 3000, 9000, 20000, 40000, 65535].map(
      (frequency) =>
        settled(new WaveStream().entry({ 0: sounding({ frequency, waveform: WAVEFORM_TRIANGLE }) }))
          .cycles
    );

    for (let i = 1; i < cycles.length; i++) expect(cycles[i]).toBeGreaterThanOrEqual(cycles[i - 1]);
    expect(cycles[0]).toBe(WAVE_CYCLES_LOW);
    expect(cycles[cycles.length - 1]).toBeLessThanOrEqual(WAVE_CYCLES_HIGH);
    expect(cycles[4]).toBeGreaterThan(cycles[1]);
  });

  it('gives an arpeggio of three pitches three distinct cycle counts', () => {
    const stream = new WaveStream();
    for (const frequency of [1000, 1500, 2000]) {
      stream.entry({ 0: sounding({ frequency, waveform: WAVEFORM_PULSE }) });
    }

    const cycles = new Set(stream.trace(new WaveBankModel(), 0, (view) => view.cycles));

    expect(cycles.size).toBe(3);
  });
});

describe('WaveBankModel ring and sync', () => {
  const pair = (
    voice: WaveVoice,
    source: WaveVoice,
    own: Record<string, number>,
    from: Record<string, number>
  ) => settled(new WaveStream().entry({ [voice]: sounding(own), [source]: sounding(from) }), voice);

  it('ring changes a triangle only, and sync cuts any shape short', () => {
    const base = { frequency: 1000 };
    const source = { frequency: 2000, waveform: WAVEFORM_SAWTOOTH };
    const withRing = (waveform: number, ring: number) =>
      pair(0, 2, { ...base, waveform, ring }, source);
    const withSync = (waveform: number, sync: number) =>
      pair(0, 2, { ...base, waveform, sync }, source);

    expect(sampled(withRing(WAVEFORM_TRIANGLE, 1))).not.toEqual(
      sampled(withRing(WAVEFORM_TRIANGLE, 0))
    );
    expect(sampled(withRing(WAVEFORM_SAWTOOTH, 1))).toEqual(
      sampled(withRing(WAVEFORM_SAWTOOTH, 0))
    );
    expect(sampled(withRing(WAVEFORM_PULSE, 1))).toEqual(sampled(withRing(WAVEFORM_PULSE, 0)));
    for (const waveform of [WAVEFORM_TRIANGLE, WAVEFORM_SAWTOOTH, WAVEFORM_PULSE]) {
      expect(sampled(withSync(waveform, 1))).not.toEqual(sampled(withSync(waveform, 0)));
    }
  });

  it('takes the neighbouring voice as the source: 0 from 2, 1 from 0, 2 from 1', () => {
    const fields = (frequency: number, extra = {}) =>
      sounding({ frequency, waveform: WAVEFORM_TRIANGLE, ...extra });
    const stream = new WaveStream().entry({
      0: fields(300, { sync: 1 }),
      1: fields(600, { sync: 1 }),
      2: fields(1200, { sync: 1 }),
    });
    const model = new WaveBankModel();
    stream.ingestAll(model);
    model.step(stream.timeMs);

    const ratio = (voice: WaveVoice) => model.view(voice).syncCycles / model.view(voice).cycles;
    expect(ratio(0)).toBeCloseTo(4, 5);
    expect(ratio(1)).toBeCloseTo(0.5, 5);
    expect(ratio(2)).toBeCloseTo(0.5, 5);
  });

  it('has no effect from a source at frequency 0, and keeps the real ratio up to its limit', () => {
    const own = { frequency: 1000, waveform: WAVEFORM_TRIANGLE, ring: 1, sync: 1 };
    const silent = pair(0, 2, own, { frequency: 0, waveform: WAVEFORM_SAWTOOTH });
    expect([silent.syncCycles, silent.ringCycles]).toEqual([0, 0]);

    const octave = pair(0, 2, own, { frequency: 2000, waveform: WAVEFORM_SAWTOOTH });
    expect(octave.ringCycles).toBeCloseTo(octave.cycles * 2, 5);

    const far = pair(0, 2, own, { frequency: 60000, waveform: WAVEFORM_SAWTOOTH });
    expect(far.ringCycles).toBeLessThanOrEqual(14);
    expect(far.ringCycles).toBeGreaterThan(octave.ringCycles);
  });
});

describe('the recorded drum stream', () => {
  interface Fixture {
    attacks: number[];
    entries: { timeMs: number; voices: number[][] }[];
  }
  const fixture = JSON.parse(
    readFileSync(resolve(__dirname, '__fixtures__/drum-stream.json'), 'utf8')
  ) as Fixture;

  it('replays with each follower seeing as many attacks as the script counted', () => {
    const model = new WaveBankModel();
    const data = new Float64Array(WAVE_FEED_LENGTH);
    for (const entry of fixture.entries) {
      data[WAVE_HEADER_LENGTH] = entry.timeMs;
      entry.voices.forEach((fields, voice) => {
        expect(fields).toHaveLength(WAVE_VOICE_FIELDS);
        data.set(fields, WAVE_HEADER_LENGTH + 1 + voice * WAVE_VOICE_FIELDS);
      });
      model.ingestEntry(data, WAVE_HEADER_LENGTH);
      model.step(entry.timeMs);
    }

    expect([0, 1, 2].map((voice) => model.attackCount(voice as WaveVoice))).toEqual(
      fixture.attacks
    );
  });
});
