import type { Note } from './notes';

export interface TuningResult {
  readonly referenceHz: number;
  readonly cents: number;
}

export interface KeyResult {
  readonly chroma: Float32Array; // 12 bins, duration-weighted
  readonly tonic: number | null; // 0..11, null = no clear key
  readonly mode: 'major' | 'minor' | null;
  readonly camelot: string | null; // e.g. '4A'
  readonly confidence: 'strong' | 'weak' | 'none';
  readonly tuning: TuningResult | null;
  readonly scalePitchClasses: readonly number[]; // for the out-of-scale overlay
}

export const PITCH_CLASS_NAMES: readonly string[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

const PITCH_CLASS_COUNT = 12;
const PITCH_CLASS_A = 9;
const A4_REFERENCE_HZ = 440;

/** Below this the distinct-pitch set is a handful of notes rather than a frequency table, and the
 *  offset it would produce says more about those few notes than about the tune's tuning. */
const MIN_DISTINCT_PITCHES = 4;

/** Mean-resultant length of the folded pitch set. A set that sits on an equal-tempered grid lands
 *  near 1; a scattered set with no grid to fit falls towards 1/sqrt(n). */
const MIN_TUNING_CONCENTRATION = 0.5;

/** Two pitch classes name a key only by accident — an interval is not a harmony. */
const MIN_DISTINCT_PITCH_CLASSES = 3;

/** Fraction of the chroma's weight that must land inside the winning scale. Twelve similar bins sit
 *  at 7/12 = 0.58 no matter which profile technically wins, which is exactly the case this rejects. */
const MIN_DIATONIC_MASS = 0.7;
const MIN_KEY_CORRELATION = 0.55;
const STRONG_CORRELATION = 0.7;
const STRONG_MARGIN = 0.05;

/** Krumhansl–Kessler key profiles, rotated per candidate tonic. */
const MAJOR_PROFILE: readonly number[] = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];
const MINOR_PROFILE: readonly number[] = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

const MAJOR_SCALE_STEPS: readonly number[] = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE_STEPS: readonly number[] = [0, 2, 3, 5, 7, 8, 10];

/**
 * Camelot numbers, indexed by tonic pitch class. A table rather than arithmetic at the call site:
 * the wheel's numbering is a circle of fifths, so deriving it inline is a modular-arithmetic puzzle
 * that reads as a typo when it is right and as a typo when it is wrong.
 */
const CAMELOT_MINOR: readonly string[] = [
  '5A', // C
  '12A', // C#
  '7A', // D
  '2A', // D#
  '9A', // E
  '4A', // F
  '11A', // F#
  '6A', // G
  '1A', // G#
  '8A', // A
  '3A', // A#
  '10A', // B
];
const CAMELOT_MAJOR: readonly string[] = [
  '8B', // C
  '3B', // C#
  '10B', // D
  '5B', // D#
  '12B', // E
  '7B', // F
  '2B', // F#
  '9B', // G
  '4B', // G#
  '11B', // A
  '6B', // A#
  '1B', // B
];

/**
 * Recovers the tuning the tune was written against from the pitches it actually uses.
 *
 * The set of distinct pitches a tune plays is effectively its player's frequency table, so folding
 * that set into a single octave in log space and finding the offset that best aligns it to an
 * equal-tempered grid recovers the reference the table was generated from. Assuming A440 instead
 * would fold every pitch class against the wrong grid and name a neighbouring key with no error
 * anywhere.
 *
 * Returns null when the set is too small to be a table, or too scattered to fit a grid at all.
 */
export function recoverTuning(notes: readonly Note[]): TuningResult | null {
  const distinct = new Set<number>();
  for (const note of notes) {
    if (note.hz > 0) {
      distinct.add(note.hz);
    }
  }
  if (distinct.size < MIN_DISTINCT_PITCHES) {
    return null;
  }

  // Circular mean: the fold is modulo one semitone, so +49 cents and -49 cents are two cents apart,
  // and a linear average of them would report the middle of the wrong semitone.
  let sumCos = 0;
  let sumSin = 0;
  for (const hz of distinct) {
    const semitones = 12 * Math.log2(hz / A4_REFERENCE_HZ);
    const angle = 2 * Math.PI * (semitones - Math.floor(semitones));
    sumCos += Math.cos(angle);
    sumSin += Math.sin(angle);
  }

  if (Math.hypot(sumCos, sumSin) / distinct.size < MIN_TUNING_CONCENTRATION) {
    return null;
  }

  const cents = (Math.atan2(sumSin, sumCos) / (2 * Math.PI)) * 100;
  return { referenceHz: centsToReferenceHz(cents), cents };
}

/**
 * Names the key a set of notes is in, or reports that it has none.
 *
 * Chroma is duration-weighted — a pitch that sounds for a bar counts for a bar — and folded against
 * the recovered tuning rather than an assumed A440. The winner is the best-correlating of the
 * twenty-four major and minor profiles, but winning is not enough: SID music is harmonically thin
 * and plenty of it is chromatic or effect-driven, so a win with no margin over the runner-up, or one
 * whose chroma is spread evenly across all twelve bins, reports no key at all. Naming a key anyway
 * is the worst outcome available, because it fails silently.
 */
export function detectKey(notes: readonly Note[]): KeyResult {
  const tuning = recoverTuning(notes);
  const chroma = buildChroma(notes, tuning);

  let total = 0;
  let present = 0;
  for (let pc = 0; pc < PITCH_CLASS_COUNT; pc++) {
    total += chroma[pc];
    if (chroma[pc] > 0) {
      present++;
    }
  }
  if (total <= 0 || present < MIN_DISTINCT_PITCH_CLASSES) {
    return noKey(chroma, tuning);
  }

  let bestCorrelation = -Infinity;
  let secondCorrelation = -Infinity;
  let bestTonic = 0;
  let bestMode: 'major' | 'minor' = 'major';
  for (let tonic = 0; tonic < PITCH_CLASS_COUNT; tonic++) {
    for (const mode of ['major', 'minor'] as const) {
      const correlation = correlateProfile(chroma, tonic, mode);
      if (correlation > bestCorrelation) {
        secondCorrelation = bestCorrelation;
        bestCorrelation = correlation;
        bestTonic = tonic;
        bestMode = mode;
      } else if (correlation > secondCorrelation) {
        secondCorrelation = correlation;
      }
    }
  }

  const scalePitchClasses = scaleFor(bestTonic, bestMode);
  let diatonicWeight = 0;
  for (const pc of scalePitchClasses) {
    diatonicWeight += chroma[pc];
  }
  const confidence = classifyConfidence(bestCorrelation, secondCorrelation, diatonicWeight / total);
  if (confidence === 'none') {
    return noKey(chroma, tuning);
  }

  return {
    chroma,
    tonic: bestTonic,
    mode: bestMode,
    camelot: camelotFor(bestTonic, bestMode),
    confidence,
    tuning,
    scalePitchClasses,
  };
}

/**
 * Keys each section between `boundaries` independently, so a modulation is visible rather than
 * averaged away. Boundaries are frame numbers naming interior splits; a note belongs to the section
 * its start frame falls in.
 */
export function detectKeyPerSection(
  notes: readonly Note[],
  boundaries: readonly number[]
): readonly KeyResult[] {
  const splits = [...boundaries].filter((frame) => frame > 0).sort((a, b) => a - b);
  const sections: Note[][] = Array.from({ length: splits.length + 1 }, () => []);
  for (const note of notes) {
    let index = 0;
    while (index < splits.length && note.startFrame >= splits[index]) {
      index++;
    }
    sections[index].push(note);
  }
  return sections.map((sectionNotes) => detectKey(sectionNotes));
}

/**
 * The sounding key when playback is pitched: the speed multiplier scales the frame clock and
 * therefore every pitch with it, so a deck at +6% sounds roughly a semitone above its native key.
 *
 * Where the shift lands between semitones the nearest is named and the remainder is reported as the
 * sounding tuning's deviation, rather than rounded away silently. The tune's own tuning offset folds
 * into that same deviation, because a tune already 40 cents sharp played 70 cents up sounds a
 * semitone above, not a semitone and a tenth.
 */
export function soundingKey(key: KeyResult, speedMultiplier: number): KeyResult {
  if (key.tonic === null || key.mode === null || !(speedMultiplier > 0) || speedMultiplier === 1) {
    return key;
  }

  const totalCents = (key.tuning?.cents ?? 0) + 12 * Math.log2(speedMultiplier) * 100;
  const semitones = Math.round(totalCents / 100);
  const cents = totalCents - semitones * 100;
  const tonic = wrapPitchClass(key.tonic + semitones);

  const chroma = new Float32Array(PITCH_CLASS_COUNT);
  for (let pc = 0; pc < PITCH_CLASS_COUNT; pc++) {
    chroma[wrapPitchClass(pc + semitones)] = key.chroma[pc];
  }

  return {
    chroma,
    tonic,
    mode: key.mode,
    camelot: camelotFor(tonic, key.mode),
    confidence: key.confidence,
    tuning: { referenceHz: centsToReferenceHz(cents), cents },
    scalePitchClasses: scaleFor(tonic, key.mode),
  };
}

/** `'C minor'`, `'A major'` — null when no key was found, so callers cannot print a name for one. */
export function keyName(key: KeyResult): string | null {
  return key.tonic === null || key.mode === null
    ? null
    : `${PITCH_CLASS_NAMES[key.tonic]} ${key.mode}`;
}

export function camelotFor(tonic: number, mode: 'major' | 'minor'): string {
  const pitchClass = wrapPitchClass(tonic);
  return mode === 'minor' ? CAMELOT_MINOR[pitchClass] : CAMELOT_MAJOR[pitchClass];
}

export function scaleFor(tonic: number, mode: 'major' | 'minor'): readonly number[] {
  const steps = mode === 'minor' ? MINOR_SCALE_STEPS : MAJOR_SCALE_STEPS;
  return steps.map((step) => wrapPitchClass(tonic + step));
}

/**
 * Whether a pitch falls outside the key's scale — the overlay's test, folded against the same
 * recovered reference the chroma was built from so the marks and the verdict cannot disagree.
 *
 * A result with no key has no scale, so nothing is outside it.
 */
export function isOutOfScale(hz: number, key: KeyResult): boolean {
  if (key.scalePitchClasses.length === 0 || hz <= 0) {
    return false;
  }
  return !key.scalePitchClasses.includes(pitchClassOf(hz, key.tuning));
}

/** Folds a sounding pitch onto the twelve pitch classes against the recovered reference. */
function pitchClassOf(hz: number, tuning: TuningResult | null): number {
  const referenceHz = tuning?.referenceHz ?? A4_REFERENCE_HZ;
  return wrapPitchClass(Math.round(12 * Math.log2(hz / referenceHz)) + PITCH_CLASS_A);
}

function buildChroma(notes: readonly Note[], tuning: TuningResult | null): Float32Array {
  const chroma = new Float32Array(PITCH_CLASS_COUNT);
  for (const note of notes) {
    const duration = note.endFrame - note.startFrame;
    if (duration <= 0 || note.hz <= 0) {
      continue;
    }
    chroma[pitchClassOf(note.hz, tuning)] += duration;
  }
  return chroma;
}

/** Pearson correlation against the rotated profile. A chroma with no variance — twelve identical
 *  bins — correlates with nothing, which is the honest answer rather than a division by zero. */
function correlateProfile(chroma: Float32Array, tonic: number, mode: 'major' | 'minor'): number {
  const profile = mode === 'minor' ? MINOR_PROFILE : MAJOR_PROFILE;
  let chromaMean = 0;
  let profileMean = 0;
  for (let pc = 0; pc < PITCH_CLASS_COUNT; pc++) {
    chromaMean += chroma[pc];
    profileMean += profile[pc];
  }
  chromaMean /= PITCH_CLASS_COUNT;
  profileMean /= PITCH_CLASS_COUNT;

  let covariance = 0;
  let chromaVariance = 0;
  let profileVariance = 0;
  for (let pc = 0; pc < PITCH_CLASS_COUNT; pc++) {
    const chromaDeviation = chroma[pc] - chromaMean;
    const profileDeviation = profile[wrapPitchClass(pc - tonic)] - profileMean;
    covariance += chromaDeviation * profileDeviation;
    chromaVariance += chromaDeviation * chromaDeviation;
    profileVariance += profileDeviation * profileDeviation;
  }

  const denominator = Math.sqrt(chromaVariance * profileVariance);
  return denominator === 0 ? 0 : covariance / denominator;
}

function classifyConfidence(
  best: number,
  second: number,
  diatonicMass: number
): 'strong' | 'weak' | 'none' {
  if (best < MIN_KEY_CORRELATION || diatonicMass < MIN_DIATONIC_MASS) {
    return 'none';
  }
  return best >= STRONG_CORRELATION && best - second >= STRONG_MARGIN ? 'strong' : 'weak';
}

/** The chroma and the tuning survive a no-key answer — both are measurements, and both are worth
 *  showing next to the verdict. The scale does not: there is no scale to be outside of. */
function noKey(chroma: Float32Array, tuning: TuningResult | null): KeyResult {
  return {
    chroma,
    tonic: null,
    mode: null,
    camelot: null,
    confidence: 'none',
    tuning,
    scalePitchClasses: [],
  };
}

function centsToReferenceHz(cents: number): number {
  return A4_REFERENCE_HZ * Math.pow(2, cents / 1200);
}

function wrapPitchClass(value: number): number {
  return ((value % PITCH_CLASS_COUNT) + PITCH_CLASS_COUNT) % PITCH_CLASS_COUNT;
}
