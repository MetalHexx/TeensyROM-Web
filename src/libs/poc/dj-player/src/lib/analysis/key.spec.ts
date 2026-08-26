import { describe, it, expect } from 'vitest';
import {
  camelotFor,
  detectKey,
  detectKeyPerSection,
  keyName,
  recoverTuning,
  soundingKey,
} from './key';
import type { Note } from './notes';

const A4_HZ = 440;

/** Semitone offsets from A4 — the pitches these fixtures are written in. */
const C3 = -21;
const D3 = -19;
const E3 = -17;
const F3 = -16;
const G3 = -14;
const A3 = -12;
const C4 = -9;
const D4 = -7;
const E4 = -5;
const F4 = -4;
const G4 = -2;
const A4 = 0;
const B4 = 2;

const PITCH_CLASS_C = 0;
const PITCH_CLASS_CSHARP = 1;
const PITCH_CLASS_A = 9;

/** One voice's line, written as [semitones from A4, frames] laid end to end. */
type Line = readonly (readonly [number, number])[];

const C_MAJOR_BASS: Line = [
  [C3, 8],
  [G3, 8],
  [C3, 8],
  [F3, 8],
  [C3, 8],
  [G3, 8],
  [C3, 16],
];
const C_MAJOR_MELODY: Line = [
  [E4, 4],
  [G4, 4],
  [C4, 4],
  [D4, 4],
  [E4, 8],
  [F4, 4],
  [E4, 4],
  [D4, 4],
  [C4, 8],
  [B4, 4],
  [C4, 8],
  [A4, 4],
  [G4, 8],
];

const A_MINOR_BASS: Line = [
  [A3, 8],
  [E3, 8],
  [A3, 8],
  [D3, 8],
  [A3, 8],
  [E3, 8],
  [A3, 16],
];
const A_MINOR_MELODY: Line = [
  [C4, 8],
  [E4, 4],
  [A4, 4],
  [C4, 8],
  [D4, 4],
  [C4, 8],
  [B4, 4],
  [A4, 8],
  [C4, 8],
  [G4, 4],
  [A4, 8],
  [E4, 4],
];

function hzFor(semitonesFromA4: number, detuneCents = 0): number {
  return A4_HZ * Math.pow(2, (semitonesFromA4 * 100 + detuneCents) / 1200);
}

function notesFor(
  lines: readonly Line[],
  detuneCents: (pitch: number) => number = () => 0
): Note[] {
  const notes: Note[] = [];
  lines.forEach((line, voice) => {
    let frame = 0;
    for (const [pitch, frames] of line) {
      notes.push({
        voice,
        startFrame: frame,
        endFrame: frame + frames,
        hz: hzFor(pitch, detuneCents(pitch)),
      });
      frame += frames;
    }
  });
  return notes;
}

/** A chromatic run with every pitch class sounding for the same time — twelve similar bins, which is
 *  no key however the profiles rank. */
function chromaticNotes(): Note[] {
  const line: Line = Array.from({ length: 12 }, (_, step) => [C4 + step, 10] as const);
  return notesFor([line]);
}

/**
 * A player's frequency table forty-seven cents sharp, its entries a few cents either side of exact
 * as a rounded table's are. Several of those pitches sit past the halfway mark to the next semitone,
 * so folding them against A440 rather than the recovered reference lands them in the wrong bin.
 */
function detunedBy47Cents(): Note[] {
  const jitter = new Map<number, number>();
  const assign = (pitch: number): number => {
    let cents = jitter.get(pitch);
    if (cents === undefined) {
      cents = jitter.size % 2 === 0 ? 6 : -6;
      jitter.set(pitch, cents);
    }
    return 47 + cents;
  };
  return notesFor([C_MAJOR_BASS, C_MAJOR_MELODY], assign);
}

describe('detectKey', () => {
  it('names the key and Camelot number of a tune written in it', () => {
    const key = detectKey(notesFor([C_MAJOR_BASS, C_MAJOR_MELODY]));

    expect(key.tonic).toBe(PITCH_CLASS_C);
    expect(key.mode).toBe('major');
    expect(key.camelot).toBe('8B');
    expect(key.confidence).toBe('strong');
    expect(keyName(key)).toBe('C major');
  });

  it('tells a minor tune from its relative major', () => {
    const key = detectKey(notesFor([A_MINOR_BASS, A_MINOR_MELODY]));

    expect(key.tonic).toBe(PITCH_CLASS_A);
    expect(key.mode).toBe('minor');
    expect(key.camelot).toBe('8A');
    expect(key.confidence).toBe('strong');
  });

  it('reports the scale its answer implies, for the out-of-scale overlay to mark against', () => {
    const key = detectKey(notesFor([C_MAJOR_BASS, C_MAJOR_MELODY]));

    expect([...key.scalePitchClasses].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('reports no key for an atonal tune rather than naming the profile that happened to win', () => {
    const key = detectKey(chromaticNotes());

    expect(key.tonic).toBeNull();
    expect(key.mode).toBeNull();
    expect(key.camelot).toBeNull();
    expect(key.confidence).toBe('none');
    expect(key.scalePitchClasses).toEqual([]);
    expect(keyName(key)).toBeNull();
  });

  it('keeps the tuning it measured even when it can name no key', () => {
    const key = detectKey(chromaticNotes());

    expect(key.tuning).not.toBeNull();
    expect((key.tuning as { cents: number }).cents).toBeCloseTo(0, 1);
  });

  it('recovers the reference a detuned tune was written against, rather than folding it into the wrong key', () => {
    const key = detectKey(detunedBy47Cents());

    expect(key.tuning).not.toBeNull();
    expect((key.tuning as { cents: number }).cents).toBeCloseTo(47, 0);
    expect(key.tonic).toBe(PITCH_CLASS_C);
    expect(key.mode).toBe('major');
    expect(key.confidence).toBe('strong');
  });

  it('weights a pitch by how long it sounded, not by how often it was written', () => {
    const brief = detectKey(
      notesFor([
        [
          [C4, 1],
          [E4, 1],
          [G4, 1],
          [F4, 40],
          [A4, 40],
          [C4, 40],
        ],
      ])
    );

    expect(brief.tonic).toBe(5); // F, the pitch the tune actually dwells on
  });
});

describe('recoverTuning', () => {
  it('returns null for a set too small to be a frequency table', () => {
    expect(
      recoverTuning(
        notesFor([
          [
            [C4, 8],
            [E4, 8],
          ],
        ])
      )
    ).toBeNull();
  });

  it('returns null for a set with no equal-tempered grid to fit', () => {
    const scattered: Line = [
      [C4, 8],
      [C4 + 0.25, 8],
      [C4 + 0.5, 8],
      [C4 + 0.75, 8],
    ];

    expect(recoverTuning(notesFor([scattered]))).toBeNull();
  });

  it('reports the reference pitch a detuned table was generated from', () => {
    const tuning = recoverTuning(detunedBy47Cents());

    expect(tuning).not.toBeNull();
    expect((tuning as { referenceHz: number }).referenceHz).toBeCloseTo(
      A4_HZ * Math.pow(2, 47 / 1200),
      1
    );
  });
});

describe('soundingKey', () => {
  it('reports the key a pitched-up deck is sounding in, above the native key', () => {
    const native = detectKey(notesFor([C_MAJOR_BASS, C_MAJOR_MELODY]));

    const sounding = soundingKey(native, 1.06);

    expect(sounding.tonic).toBe(PITCH_CLASS_CSHARP);
    expect(sounding.mode).toBe('major');
    expect(sounding.camelot).toBe('3B');
    expect(sounding.confidence).toBe(native.confidence);
  });

  it('reports the remainder as a deviation where the shift lands between semitones', () => {
    const native = detectKey(notesFor([C_MAJOR_BASS, C_MAJOR_MELODY]));

    const sounding = soundingKey(native, 1.02);

    expect(sounding.tonic).toBe(PITCH_CLASS_C);
    expect((sounding.tuning as { cents: number }).cents).toBeCloseTo(34.3, 0);
  });

  it('leaves a key untouched at normal speed', () => {
    const native = detectKey(notesFor([C_MAJOR_BASS, C_MAJOR_MELODY]));

    expect(soundingKey(native, 1)).toBe(native);
  });

  it('has nothing to shift when there is no key', () => {
    const none = detectKey(chromaticNotes());

    expect(soundingKey(none, 1.06)).toBe(none);
  });
});

describe('camelotFor', () => {
  it('places minor keys on the A ring and major on the B ring', () => {
    expect(camelotFor(9, 'minor')).toBe('8A');
    expect(camelotFor(0, 'major')).toBe('8B');
    expect(camelotFor(5, 'minor')).toBe('4A');
  });

  it('numbers the wheel so the next number is a fifth away, on both rings', () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const mode of ['major', 'minor'] as const) {
        const here = Number(camelotFor(tonic, mode).slice(0, -1));
        const aFifthUp = Number(camelotFor(tonic + 7, mode).slice(0, -1));
        expect(aFifthUp).toBe((here % 12) + 1);
      }
    }
  });

  it('gives a minor key and its relative major the same number', () => {
    for (let tonic = 0; tonic < 12; tonic++) {
      expect(camelotFor(tonic, 'minor').slice(0, -1)).toBe(
        camelotFor(tonic + 3, 'major').slice(0, -1)
      );
    }
  });
});

describe('detectKeyPerSection', () => {
  it('keys each section between the boundaries independently', () => {
    const first = notesFor([C_MAJOR_BASS, C_MAJOR_MELODY]);
    const boundary = 100;
    const second = notesFor([A_MINOR_BASS, A_MINOR_MELODY]).map((note) => ({
      ...note,
      startFrame: note.startFrame + boundary,
      endFrame: note.endFrame + boundary,
    }));

    const sections = detectKeyPerSection([...first, ...second], [boundary]);

    expect(sections).toHaveLength(2);
    expect(sections[0].tonic).toBe(PITCH_CLASS_C);
    expect(sections[0].mode).toBe('major');
    expect(sections[1].tonic).toBe(PITCH_CLASS_A);
    expect(sections[1].mode).toBe('minor');
  });

  it('treats a tune with no boundaries as a single section', () => {
    const notes = notesFor([C_MAJOR_BASS, C_MAJOR_MELODY]);

    const sections = detectKeyPerSection(notes, []);

    expect(sections).toHaveLength(1);
    expect(sections[0].tonic).toBe(detectKey(notes).tonic);
  });
});
