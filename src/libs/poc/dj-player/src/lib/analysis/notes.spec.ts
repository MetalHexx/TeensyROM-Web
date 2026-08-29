import { describe, it, expect } from 'vitest';
import { segmentNotes, registerToHz, NTSC_CPU_CLOCK_HZ, PAL_CPU_CLOCK_HZ } from './notes';
import type { Note } from './notes';
import { detectKey } from './key';
import type { ScanOutput } from './scan-tune';
import { PRIMARY_SLOT_FOR_REGISTER } from '../asid/register-frame';
import { ASID_SLOT_COUNT } from '../asid/asid-constants';

const REGISTERS_PER_VOICE = 7;
const PULSE_GATE = 0x41;
const NOISE_GATE = 0x81;
const GATE_OFF = 0x40;

/** Semitone offsets from A4, the pitches the fixtures are written in. */
const C4 = -9;
const E4 = -5;
const F4 = -4;
const G4 = -2;
const A4 = 0;
const B4 = 2;
const C5 = 3;
const D5 = 5;

const C_MAJOR = [C4, E4, G4];
const F_MAJOR = [F4, A4, C5];
const G_MAJOR = [G4, B4, D5];

function makeScan(frames: number): ScanOutput {
  return {
    slotValues: new Uint8Array(frames * ASID_SLOT_COUNT),
    writeCounts: new Uint8Array(frames),
    frames,
    callsPerFrame: 1,
  };
}

function setRegister(scan: ScanOutput, frame: number, register: number, value: number): void {
  const slot = PRIMARY_SLOT_FOR_REGISTER[register];
  scan.slotValues[frame * ASID_SLOT_COUNT + slot] = value;
}

function writeVoice(
  scan: ScanOutput,
  frame: number,
  voice: number,
  frequency: number,
  control: number
): void {
  const base = voice * REGISTERS_PER_VOICE;
  setRegister(scan, frame, base + 0, frequency & 0xff);
  setRegister(scan, frame, base + 1, (frequency >> 8) & 0xff);
  setRegister(scan, frame, base + 4, control);
}

/** The register a PAL player's frequency table would hold for a pitch, rounding as one must. */
function registerFor(semitonesFromA4: number): number {
  const hz = 440 * Math.pow(2, semitonesFromA4 / 12);
  return Math.round((hz * 2 ** 24) / PAL_CPU_CLOCK_HZ);
}

function semitonesBetween(a: number, b: number): number {
  return 12 * Math.log2(a / b);
}

function durationOf(notes: readonly Note[], predicate: (note: Note) => boolean): number {
  return notes
    .filter(predicate)
    .reduce((total, note) => total + (note.endFrame - note.startFrame), 0);
}

/** One voice, gate held down for the whole progression, cycling each chord's tones two frames at a
 *  time — how a C64 plays a chord it has no spare voices for. */
function buildArpeggiatedProgression(): ScanOutput {
  const plan: readonly (readonly [readonly number[], number])[] = [
    [C_MAJOR, 48],
    [F_MAJOR, 24],
    [G_MAJOR, 24],
    [C_MAJOR, 48],
  ];
  const frames = plan.reduce((total, [, length]) => total + length, 0);
  const scan = makeScan(frames);
  let frame = 0;
  for (const [chord, length] of plan) {
    for (let step = 0; step < length; step++) {
      const tone = chord[Math.floor(step / 2) % chord.length];
      writeVoice(scan, frame, 0, registerFor(tone), PULSE_GATE);
      frame++;
    }
  }
  return scan;
}

/** The same progression written as sustained chords, one tone per voice. */
function buildSustainedProgression(): ScanOutput {
  const plan: readonly (readonly [readonly number[], number])[] = [
    [C_MAJOR, 48],
    [F_MAJOR, 24],
    [G_MAJOR, 24],
    [C_MAJOR, 48],
  ];
  const frames = plan.reduce((total, [, length]) => total + length, 0);
  const scan = makeScan(frames);
  let frame = 0;
  for (const [chord, length] of plan) {
    for (let step = 0; step < length; step++) {
      chord.forEach((tone, voice) => {
        writeVoice(scan, frame, voice, registerFor(tone), PULSE_GATE);
      });
      frame++;
    }
  }
  return scan;
}

describe('segmentNotes', () => {
  it('resolves an arpeggio into the same key the equivalent sustained chords report', () => {
    const arpeggiated = detectKey(segmentNotes(buildArpeggiatedProgression(), 'pal'));
    const sustained = detectKey(segmentNotes(buildSustainedProgression(), 'pal'));

    expect(arpeggiated.tonic).toBe(sustained.tonic);
    expect(arpeggiated.mode).toBe(sustained.mode);
    expect(arpeggiated.camelot).toBe(sustained.camelot);
    expect(arpeggiated.confidence).toBe(sustained.confidence);
    expect(arpeggiated.tonic).not.toBeNull();
  });

  it('emits each pitch of a held arpeggio with the duration it sounded', () => {
    const notes = segmentNotes(buildArpeggiatedProgression(), 'pal');

    const distinctPitches = new Set(notes.map((note) => note.hz));
    expect(distinctPitches.size).toBe(8); // the three triads share G4

    const cNatural = registerToHz(registerFor(C4), 'pal');
    expect(durationOf(notes, (note) => note.hz === cNatural)).toBe(32);
    expect(durationOf(notes, () => true)).toBe(144);
  });

  it('collapses a vibrato to one note at its centre pitch', () => {
    const wobble = [0, 0.25, 0, -0.25];
    const scan = makeScan(40);
    for (let frame = 0; frame < 40; frame++) {
      writeVoice(scan, frame, 0, registerFor(C4 + wobble[frame % wobble.length]), PULSE_GATE);
    }

    const notes = segmentNotes(scan, 'pal');

    expect(notes).toHaveLength(1);
    expect(
      Math.abs(semitonesBetween(notes[0].hz, registerToHz(registerFor(C4), 'pal')))
    ).toBeLessThan(0.05);
  });

  it('drops a voice playing noise, so percussion contributes no pitch', () => {
    const scan = makeScan(20);
    for (let frame = 0; frame < 20; frame++) {
      writeVoice(scan, frame, 0, registerFor(C4), PULSE_GATE);
      writeVoice(scan, frame, 1, registerFor(E4), NOISE_GATE);
    }

    const notes = segmentNotes(scan, 'pal');

    expect(notes.map((note) => note.voice)).toEqual([0]);
  });

  it('splits a retriggered pitch into separate notes at the gate', () => {
    const scan = makeScan(30);
    for (let frame = 0; frame < 30; frame++) {
      const gated = frame < 10 || frame >= 20;
      writeVoice(scan, frame, 0, registerFor(C4), gated ? PULSE_GATE : GATE_OFF);
    }

    const notes = segmentNotes(scan, 'pal');

    expect(notes.map((note) => [note.startFrame, note.endFrame])).toEqual([
      [0, 10],
      [20, 30],
    ]);
  });

  it('reads pitch through the clock the tune declares', () => {
    const scan = makeScan(4);
    for (let frame = 0; frame < 4; frame++) {
      writeVoice(scan, frame, 0, registerFor(A4), PULSE_GATE);
    }

    const pal = segmentNotes(scan, 'pal')[0].hz;
    const ntsc = segmentNotes(scan, 'ntsc')[0].hz;

    expect(Math.abs(semitonesBetween(pal, 440))).toBeLessThan(0.01);
    expect(ntsc / pal).toBeCloseTo(NTSC_CPU_CLOCK_HZ / PAL_CPU_CLOCK_HZ, 6);
  });
});

describe('registerToHz', () => {
  it('converts a register value through each clock, treating an unknown standard as PAL', () => {
    expect(registerToHz(4096, 'pal')).toBeCloseTo(PAL_CPU_CLOCK_HZ / 4096, 6);
    expect(registerToHz(4096, 'ntsc')).toBeCloseTo(NTSC_CPU_CLOCK_HZ / 4096, 6);
    expect(registerToHz(4096, 'unknown')).toBe(registerToHz(4096, 'pal'));
    expect(registerToHz(4096, 'any')).toBe(registerToHz(4096, 'pal'));
  });
});
